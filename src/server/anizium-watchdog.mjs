import { execFile } from "node:child_process";
import { mkdir, open, readFile, rename, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const nativeFetch = globalThis.fetch;
const WINDOW = 300_000;

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
    return [401, 403, 429].includes(res.status) || res.status >= 500 ? "failure" : "ignore";
  } catch (error) {
    if (signal?.aborted) return "ignore";
    if (["ERR_INVALID_URL", "ERR_INVALID_CHAR", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT"].includes(error?.cause?.code || error?.code)) return "ignore";
    return "failure";
  }
}

export function createWatchdog({
  directory = resolve(process.env.ANIZIUM_WATCHDOG_STATE_DIR || ".calium-watchdog"),
  now = Date.now,
  probe = probeUpstream,
  execute = (signal) => runFile("/bin/bash", ["/opt/warp.sh"], {
    shell: false, timeout: 10_000, maxBuffer: 64 * 1024, killSignal: "SIGKILL", signal,
  }),
} = {}) {
  let busy = false;
  let stopped = false;
  let disabled = false;
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
      if (state.version !== 1 || !["ready", "waiting", "locked"].includes(state.status) ||
          (state.status === "waiting" && (!Number.isSafeInteger(state.deadline) || !Number.isSafeInteger(state.startedAt) || state.deadline - state.startedAt !== WINDOW))) {
        throw new Error("Invalid state");
      }
      return state;
    } catch (error) {
      const state = { version: 1, status: error.code === "ENOENT" ? "ready" : "locked" };
      await save(state);
      return state;
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
      if (state.status === "waiting" && (now() >= state.deadline || now() < state.startedAt)) {
        state = { version: 1, status: "locked" };
        await save(state);
      }
      if (state.status === "locked") return;
      const result = await probe(process.env, controller.signal);
      if (stopped) return;
      if (state.status === "waiting") {
        if (now() >= state.deadline || now() < state.startedAt) {
          await save({ version: 1, status: "locked" });
        } else if (result === "success") {
          await save({ version: 1, status: "ready" });
        }
      } else if (result === "failure") {
        const startedAt = now();
        await save({ version: 1, status: "waiting", startedAt, deadline: startedAt + WINDOW });
        try {
          await execute(controller.signal);
        } catch {
          console.warn("[anizium-watchdog] recovery command failed; waiting state retained");
        }
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
