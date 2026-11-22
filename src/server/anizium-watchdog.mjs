import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const runFile = promisify(execFile);
const nativeFetch = globalThis.fetch;
const REPO_RECOVERY_SCRIPT = fileURLToPath(new URL("../../scripts/warp-recovery.sh", import.meta.url));
const WINDOW = 300_000;
const RETRY_BASE = 60_000;
const RETRY_MAX = 15 * 60_000;
const ASSET_PROBE_TIMEOUT = 10_000;
const DEFAULT_RECOVERY_TIMEOUT = 60_000;
const IGNORED_ASSET_STATUSES = new Set([400, 401, 403, 404, 410, 429]);

function networkErrorCode(error) {
  return error?.cause?.code || error?.code;
}

export async function probeUpstream(env = process.env, signal, fetcher = nativeFetch) {
  const worker = env.ANIZIUM_WORKER_URL;
  if (!worker && (!env.ANIZIUM_CF_CONTROL || !env.ANIZIUM_USER_SESSION)) return "ignore";
  let url;
  try {
    url = new URL(`${(worker || "https://api.anizium.co").replace(/\/$/, "")}/page/calendar`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "ignore";
  } catch {
    return "ignore";
  }
  url.searchParams.set("_calium_probe", `${Date.now()}-${crypto.randomUUID()}`);
  const headers = {
    "cache-control": "no-cache, no-store",
    pragma: "no-cache",
    ...(worker ? (env.ANIZIUM_PROXY_KEY ? { "x-proxy-key": env.ANIZIUM_PROXY_KEY } : {}) : {
      "cf-control": env.ANIZIUM_CF_CONTROL,
      "user-session": env.ANIZIUM_USER_SESSION,
      "user-agent": env.ANIZIUM_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      accept: "application/json, text/plain, */*",
      "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
      origin: "https://x.anizium.co",
      referer: "https://x.anizium.co/",
      "sec-fetch-site": "same-site",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
    }),
  };
  try {
    const res = await fetcher(url, {
      headers, cache: "no-store", redirect: "manual",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
    });
    let upstreamAuth = false;
    let configurationError = false;
    if (worker && res.status !== 200) {
      const reader = res.body?.getReader();
      let text = "";
      if (reader) {
        try {
          while (text.length < 4096) {
            const { done, value } = await reader.read();
            if (done) break;
            text += new TextDecoder().decode(value.subarray(0, 4096 - text.length));
          }
          const error = JSON.parse(text).error || "";
          upstreamAuth = /^HTTP (401|403)$/.test(error);
          configurationError = /unauthorized|invalid.*(?:proxy|key)|missing.*(?:credential|session|cf.control)|env değişkenleri zorunlu/i.test(error);
        } catch {} finally {
          await reader.cancel().catch(() => {});
        }
      }
    } else {
      await res.body?.cancel();
    }
    if (res.status === 200) return "success";
    if (configurationError) return "ignore";
    if (worker && [401, 403].includes(res.status) && !upstreamAuth) return "ignore";
    return [401, 403].includes(res.status) || res.status >= 500 ? "failure" : "ignore";
  } catch (error) {
    if (signal?.aborted) return "ignore";
    if (["ERR_INVALID_URL", "ERR_INVALID_CHAR", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT"].includes(networkErrorCode(error))) return "ignore";
    return "failure";
  }
}

export async function probeAsset(env = process.env, signal, fetcher = nativeFetch) {
  const worker = env.ANIZIUM_WORKER_URL;
  const assetUrl = env.ANIZIUM_WATCHDOG_ASSET_URL;
  if (!worker || !assetUrl) return "ignore";

  let url;
  try {
    const asset = new URL(assetUrl);
    if (!["http:", "https:"].includes(asset.protocol) || asset.username || asset.password) return "ignore";
    url = new URL(`${worker.replace(/\/$/, "")}/__asset`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "ignore";
    url.searchParams.set("url", asset.toString());
  } catch {
    return "ignore";
  }

  const headers = { range: "bytes=0-1023", accept: "*/*" };
  if (env.ANIZIUM_PROXY_KEY) headers["x-proxy-key"] = env.ANIZIUM_PROXY_KEY;

  try {
    const res = await fetcher(url, {
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(ASSET_PROBE_TIMEOUT)]) : AbortSignal.timeout(ASSET_PROBE_TIMEOUT),
    });
    if (![200, 206].includes(res.status)) {
      await res.body?.cancel().catch(() => {});
      return IGNORED_ASSET_STATUSES.has(res.status) ? "ignore" : "failure";
    }

    const reader = res.body?.getReader();
    if (!reader) return "failure";
    try {
      const { value } = await reader.read();
      return value && value.byteLength > 0 ? "success" : "failure";
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch (error) {
    if (signal?.aborted) return "ignore";
    if (["ERR_INVALID_URL", "ERR_INVALID_CHAR", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT"].includes(networkErrorCode(error))) return "ignore";
    return "failure";
  }
}

export async function probeAll(env = process.env, signal, fetcher = nativeFetch) {
  const [api, asset] = await Promise.all([
    probeUpstream(env, signal, fetcher),
    probeAsset(env, signal, fetcher),
  ]);
  if (api === "failure" || asset === "failure") return "failure";
  if (api === "success" || asset === "success") return "success";
  return "ignore";
}

function waitingState(at, attempts) {
  const delay = attempts <= 1 ? WINDOW : Math.min(RETRY_MAX, RETRY_BASE * 2 ** (attempts - 2));
  return { version: 1, status: "waiting", startedAt: at, deadline: at + delay, attempts };
}

export function createWatchdog({
  directory = resolve(process.env.ANIZIUM_WATCHDOG_STATE_DIR || ".calium-watchdog"),
  now = Date.now,
  probe = probeAll,
  execute = (signal) => {
    const configured = process.env.ANIZIUM_WATCHDOG_RECOVERY_SCRIPT;
    const script = configured || (existsSync(REPO_RECOVERY_SCRIPT) ? REPO_RECOVERY_SCRIPT : "/opt/warp.sh");
    const timeoutValue = Number(process.env.ANIZIUM_WATCHDOG_RECOVERY_TIMEOUT_MS);
    const timeout = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_RECOVERY_TIMEOUT;
    return runFile("/bin/bash", [script], {
      shell: false, timeout, maxBuffer: 64 * 1024, killSignal: "SIGKILL", signal,
    });
  },
} = {}) {
  let busy = false;
  let stopped = false;
  let disabled = false;
  let lockWarned = false;
  const controller = new AbortController();
  const lock = join(directory, "lock");
  const statePath = join(directory, "state.json");

  async function save(state) {
    const temporary = join(directory, "state.tmp");
    const file = await open(temporary, "w", 0o600);
    try {
      await file.writeFile(JSON.stringify(state));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, statePath);
    const parent = await open(directory, "r");
    try { await parent.sync(); } finally { await parent.close(); }
  }

  async function load() {
    try {
      const state = JSON.parse(await readFile(statePath, "utf8"));
      const validWaiting = state.status !== "waiting" || (
        Number.isSafeInteger(state.startedAt) &&
        Number.isSafeInteger(state.deadline) &&
        state.deadline >= state.startedAt &&
        (state.attempts === undefined || (Number.isSafeInteger(state.attempts) && state.attempts >= 1))
      );
      if (state.version !== 1 || !["ready", "waiting", "locked"].includes(state.status) || !validWaiting) {
        throw new Error("Invalid state");
      }
      return state;
    } catch (error) {
      // A corrupt/unreadable state is fail-closed; recovery must not run until an operator inspects it.
      const state = { version: 1, status: error.code === "ENOENT" ? "ready" : "locked" };
      await save(state);
      return state;
    }
  }

  async function recover(attempts) {
    console.warn(`[anizium-watchdog] upstream probe failed; running recovery (attempt ${attempts})`);
    try {
      await execute(controller.signal);
      console.log("[anizium-watchdog] recovery command completed");
      return true;
    } catch (error) {
      console.warn("[anizium-watchdog] recovery command failed; retry scheduled", error?.message || "");
      return false;
    }
  }

  async function check() {
    if (busy || stopped || disabled) return;
    busy = true;
    let acquired = false;
    let safe = true;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      try {
        await mkdir(lock, { mode: 0o700 });
        acquired = true;
      } catch (error) {
        if (error.code === "EEXIST") return;
        throw error;
      }

      let state = await load();
      if (state.status === "locked") {
        if (!lockWarned) {
          lockWarned = true;
          console.warn("[anizium-watchdog] state is locked; manual inspection required");
        }
        return;
      }

      if (state.status === "waiting" && now() < state.startedAt) {
        console.warn("[anizium-watchdog] clock moved backwards; resetting to ready");
        state = { version: 1, status: "ready" };
        await save(state);
      }

      const result = await probe(process.env, controller.signal);
      if (stopped) return;

      if (state.status === "waiting") {
        if (result === "success") {
          await save({ version: 1, status: "ready" });
          console.log("[anizium-watchdog] upstream recovered");
          return;
        }
        if (result === "failure" && now() >= state.deadline) {
          const attempts = (state.attempts ?? 1) + 1;
          await save(waitingState(now(), attempts));
          await recover(attempts);
        } else if (result === "ignore" && now() >= state.deadline) {
          await save({ ...state, startedAt: now(), deadline: now() + WINDOW });
          console.warn("[anizium-watchdog] probe inconclusive; observation window extended");
        }
        return;
      }

      if (result === "failure") {
        const next = waitingState(now(), 1);
        await save(next);
        await recover(next.attempts);
      }
    } catch {
      safe = false;
      disabled = true;
      console.warn("[anizium-watchdog] state unavailable; disabled until manual inspection");
    } finally {
      if (acquired && safe) await rmdir(lock).catch(() => { disabled = true; });
      busy = false;
    }
  }

  return {
    check,
    stop() { stopped = true; controller.abort(); },
  };
}

export function startAniziumWatchdog() {
  const watchdog = createWatchdog();
  const interval = setInterval(() => { void watchdog.check(); }, 30_000);
  interval.unref();
  globalThis.__calium_anizium_failure = () => { void watchdog.check(); };
  void watchdog.check();
  return () => {
    delete globalThis.__calium_anizium_failure;
    clearInterval(interval);
    watchdog.stop();
  };
}
