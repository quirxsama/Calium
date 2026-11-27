import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Cut = { from: number; to: number };
type CutStatus = "cut" | "none" | "failed";
type CutResult = { status: CutStatus; cut: Cut | null };
type Entry = { result: CutResult; at: number };

// Bump when the detection rules change so stale cached verdicts are ignored.
const DETECT_VERSION = 2;
const CUT_TTL_MS = 6 * 60 * 60 * 1000;
// A "none" verdict is only cached when it is backed by a full 10s+ decode.
const NONE_TTL_MS = 6 * 60 * 60 * 1000;
// Transient failures (429/502/timeout) are never cached long.
const FAILED_TTL_MS = 25_000;
const DETECT_TIMEOUT_MS = 20_000;
const DETECT_WINDOW_SECONDS = 20;
const MIN_DECODED_SECONDS = 10;
const PREFIX_BYTES = 24 * 1024 * 1024;
const MIN_PREFIX_BYTES = 200_000;
const MAX_CACHE_ENTRIES = 512;

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<CutResult>>();

function allowedTarget(raw: string, base: string): URL | null {
  if (!raw) return null;
  let target: URL;
  try {
    target = new URL(raw, base);
  } catch {
    return null;
  }
  if (target.pathname !== "/api/anizium/asset") return null;
  const allowedHosts = new Set([
    "calium.fun",
    "www.calium.fun",
    "video.calium.fun",
    "localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
  ]);
  if (!allowedHosts.has(target.hostname)) return null;
  return target;
}

/** Resolve the asset URL hidden in an /api/anizium/asset wrapper (or the URL itself). */
function innerAssetUrl(target: URL): { inner: URL; wrapped: boolean } {
  const raw = target.searchParams.get("url");
  if (!raw) return { inner: target, wrapped: false };
  try {
    return { inner: new URL(raw, target.origin), wrapped: true };
  } catch {
    return { inner: target, wrapped: false };
  }
}

function wrapAssetUrl(wrapper: URL, inner: URL, wrapped: boolean): string {
  if (!wrapped) return inner.toString();
  const out = new URL(wrapper);
  out.searchParams.set("url", inner.toString());
  return out.toString();
}

/**
 * Probe the smallest rendition first: 480p decodes far faster from a bounded
 * prefix than 1080p. Any quality token is rewritten, but the variant
 * (original/trdub/endub) is preserved so a dub never inherits another cut.
 */
function probeTargets(target: URL): string[] {
  const { inner, wrapped } = innerAssetUrl(target);
  const original = inner.toString();
  const swapped = original.replace(/\/(\d+p)\.([a-z0-9]+)\.mp4(\?|$)/i, "/480p.$2.mp4$3");
  const list: string[] = [];
  if (swapped !== original) {
    try {
      list.push(wrapAssetUrl(target, new URL(swapped), wrapped));
    } catch {}
  }
  list.push(wrapAssetUrl(target, inner, wrapped));
  return list.filter((value, index) => list.indexOf(value) === index);
}

/** Cache key: episode identity + variant, independent of quality/CDN/wrapper. */
function cacheKey(raw: string): string {
  try {
    let url = new URL(raw);
    for (let depth = 0; depth < 3; depth++) {
      const inner = url.searchParams.get("url");
      if (!inner) break;
      try {
        url = new URL(inner, url.origin);
      } catch {
        break;
      }
    }
    let pathname = url.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch {}
    const match = pathname.match(
      /\/(\d+)\/(\d+)\/(\d+)\/(?:(\d+)p\.)?(original|trdub|endub)\.mp4/i
    );
    const identity = match
      ? `${match[1]}/${match[2]}/${match[3]}/${match[5].toLowerCase()}`
      : // Slug-based libraries (one-pace, TYBW) still key per variant, never
        // per quality, so a 1440p request reuses the 480p detection.
        pathname.replace(/\/\d+p\./g, "/").replace(/\/+$/, "");
    return `v${DETECT_VERSION}:${identity.toLowerCase()}`;
  } catch {
    return `v${DETECT_VERSION}:${raw}`;
  }
}

async function downloadPrefix(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DETECT_TIMEOUT_MS);
  const file = path.join(os.tmpdir(), `calium-startcut-${crypto.randomUUID()}.mp4`);
  const handle = await fs.promises.open(file, "w");
  let keep = false;
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${PREFIX_BYTES - 1}` },
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    let total = 0;
    while (total < PREFIX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = PREFIX_BYTES - total;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      await handle.write(slice);
      total += slice.byteLength;
      if (slice.byteLength < value.byteLength) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    if (total < MIN_PREFIX_BYTES) return null;
    keep = true;
    return file;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    await handle.close().catch(() => {});
    if (!keep) await fs.promises.unlink(file).catch(() => {});
  }
}

type BlackGap = { from: number; to: number; duration: number };

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function detectCut(file: string): Promise<CutResult> {
  return new Promise((resolve) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "info",
        "-ss",
        "0",
        "-t",
        String(DETECT_WINDOW_SECONDS),
        "-i",
        file,
        "-vf",
        "blackdetect=d=0.45:pix_th=0.10",
        "-af",
        "silencedetect=noise=-35dB:d=0.35",
        "-f",
        "null",
        "-",
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );

    let stderr = "";
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const finish = (result: CutResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve(result);
    };
    timer = setTimeout(() => finish({ status: "failed", cut: null }), DETECT_TIMEOUT_MS);

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 48_000) stderr = stderr.slice(-48_000);
    });
    proc.on("error", () => finish({ status: "failed", cut: null }));
    proc.on("close", () => {
      const gaps: BlackGap[] = [];
      // A black interval that never closes means the window (or file) ended
      // inside a black stretch: the verdict is unknown, never "none".
      let incomplete = false;
      let current: { from?: number; to?: number } | null = null;
      for (const match of stderr.matchAll(/(black_start|black_end|black_duration):\s*([0-9.]+)/g)) {
        const value = Number(match[2]);
        if (!Number.isFinite(value)) continue;
        if (match[1] === "black_start") {
          if (current && current.from != null) incomplete = true;
          current = { from: value };
        } else if (match[1] === "black_end") {
          if (current && current.from != null) current.to = value;
        } else if (current && current.from != null) {
          if (current.to == null) {
            incomplete = true;
          } else {
            gaps.push({ from: current.from, to: current.to, duration: value });
            current = null;
          }
        }
      }
      if (current && current.from != null) incomplete = true;

      const silenceStarts: number[] = [];
      for (const match of stderr.matchAll(/silence_start:\s*(-?[0-9.]+)/g)) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value >= 0) silenceStarts.push(value);
      }

      let decoded = 0;
      for (const match of stderr.matchAll(/time=\s*(-?)(\d+):(\d+):([0-9.]+)/g)) {
        if (match[1] === "-") continue;
        const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
        if (Number.isFinite(seconds) && seconds > decoded) decoded = seconds;
      }

      const silenceNear = (from: number) =>
        silenceStarts.some((start) => Math.abs(start - from) <= 0.6);

      const accepted = gaps
        .filter(
          (gap) =>
            gap.from >= 1.5 &&
            gap.from <= 5.5 &&
            gap.to <= DETECT_WINDOW_SECONDS &&
            gap.to > gap.from &&
            gap.duration >= 0.7 &&
            gap.duration <= 15
        )
        // A gap that starts before 3.5s needs the silence detector to agree so
        // a genuinely dark cold open is never skipped.
        .filter((gap) => gap.from >= 3.5 || silenceNear(gap.from))
        .sort((a, b) => {
          const aPreferred = a.from >= 3.5 && a.from <= 5.5 ? 1 : 0;
          const bPreferred = b.from >= 3.5 && b.from <= 5.5 ? 1 : 0;
          if (aPreferred !== bPreferred) return bPreferred - aPreferred;
          return b.duration - a.duration;
        });

      if (accepted.length > 0) {
        const gap = accepted[0];
        finish({ status: "cut", cut: { from: round3(gap.from), to: round3(gap.to) } });
        return;
      }

      if (incomplete || decoded < MIN_DECODED_SECONDS) {
        finish({ status: "failed", cut: null });
        return;
      }

      finish({ status: "none", cut: null });
    });
  });
}

async function runDetection(url: string): Promise<{ result: CutResult; downloaded: boolean }> {
  const file = await downloadPrefix(url);
  if (!file) return { result: { status: "failed", cut: null }, downloaded: false };
  try {
    return { result: await detectCut(file), downloaded: true };
  } finally {
    await fs.promises.unlink(file).catch(() => {});
  }
}

function pruneCache(now: number) {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  for (const [key, entry] of cache) {
    const ttl = entry.result.status === "failed" ? FAILED_TTL_MS : CUT_TTL_MS;
    if (now - entry.at >= ttl) cache.delete(key);
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

async function resolveCut(requestUrl: string): Promise<CutResult> {
  const key = cacheKey(requestUrl);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached) {
    const ttl =
      cached.result.status === "cut"
        ? CUT_TTL_MS
        : cached.result.status === "none"
          ? NONE_TTL_MS
          : FAILED_TTL_MS;
    if (now - cached.at < ttl) return cached.result;
  }
  const running = inflight.get(key);
  if (running) return running;

  const task = (async (): Promise<CutResult> => {
    const targets = probeTargets(new URL(requestUrl));
    let result: CutResult = { status: "failed", cut: null };
    for (let index = 0; index < targets.length; index++) {
      const attempt = await runDetection(targets[index]);
      result = attempt.result;
      // Only fall back to the originally requested rendition when the small
      // probe could not even be fetched; a completed detection is authoritative.
      if (attempt.downloaded) break;
    }
    return result;
  })()
    .then((result) => {
      cache.set(key, { result, at: Date.now() });
      pruneCache(Date.now());
      return result;
    })
    .catch((): CutResult => ({ status: "failed", cut: null }))
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  return task;
}

export async function GET(req: NextRequest) {
  const target = allowedTarget(
    req.nextUrl.searchParams.get("url")?.trim() ?? "",
    req.nextUrl.origin
  );
  if (!target) {
    return NextResponse.json({ success: false, error: "invalid url" }, { status: 400 });
  }

  const result = await resolveCut(target.toString());
  return NextResponse.json(
    { success: true, status: result.status, cut: result.cut },
    {
      headers: {
        "Cache-Control": result.status === "failed" ? "no-store" : "public, max-age=21600",
      },
    }
  );
}
