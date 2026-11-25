import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Cut = { from: number; to: number };
type Entry = { cut: Cut | null; at: number };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NULL_TTL_MS = 10 * 60 * 1000;
const DETECT_TIMEOUT_MS = 15_000;
const PREFIX_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Cut | null>>();

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

function probeAssetUrl(target: URL): string {
  const inner = target.searchParams.get("url");
  if (!inner) return target.toString();
  const swapped = inner.replace(/\/\d+p\.original\.mp4(\?|$)/, "/480p.original.mp4$1");
  if (swapped === inner) return target.toString();
  const probe = new URL(target);
  probe.searchParams.set("url", swapped);
  return probe.toString();
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
        await reader.cancel();
        break;
      }
    }
    if (total < 200_000) return null;
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

function detectCut(file: string): Promise<Cut | null> {
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
        "12",
        "-i",
        file,
        "-an",
        "-vf",
        "blackdetect=d=0.45:pix_th=0.10",
        "-f",
        "null",
        "-",
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );

    let stderr = "";
    let settled = false;
    const finish = (cut: Cut | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve(cut);
    };
    const timer = setTimeout(() => finish(null), DETECT_TIMEOUT_MS);

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 24_000) stderr = stderr.slice(-24_000);
    });
    proc.on("error", () => finish(null));
    proc.on("close", () => {
      const pattern = /black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g;
      let match: RegExpExecArray | null;
      let cut: Cut | null = null;
      while ((match = pattern.exec(stderr))) {
        const from = Number(match[1]);
        const to = Number(match[2]);
        const duration = Number(match[3]);
        // Anizium bumper logo ends near 4.4s; only skip the black gap that
        // starts right after it, never an in-episode dark scene.
        if (
          Number.isFinite(from) &&
          Number.isFinite(to) &&
          from >= 3.5 &&
          from <= 5.5 &&
          to > from &&
          to <= 12 &&
          duration >= 0.7 &&
          duration <= 4.5
        ) {
          cut = { from: Math.round(from * 1000) / 1000, to: Math.round(to * 1000) / 1000 };
        }
      }
      finish(cut);
    });
  });
}

async function resolveCut(url: string): Promise<Cut | null> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.at < (cached.cut ? CACHE_TTL_MS : NULL_TTL_MS)) {
    return cached.cut;
  }
  const running = inflight.get(url);
  if (running) return running;

  const task = (async () => {
    const file = await downloadPrefix(probeAssetUrl(new URL(url)));
    if (!file) return null;
    try {
      return await detectCut(file);
    } finally {
      await fs.promises.unlink(file).catch(() => {});
    }
  })()
    .then((cut) => {
      cache.set(url, { cut, at: Date.now() });
      return cut;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, task);
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

  const cut = await resolveCut(target.toString());
  return NextResponse.json(
    { success: true, cut },
    { headers: { "Cache-Control": "public, max-age=21600" } }
  );
}
