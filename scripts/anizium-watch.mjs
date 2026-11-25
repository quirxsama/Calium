import fs from "node:fs";
import https from "node:https";

const DIR = process.env.ANIZIUM_WATCH_DIR || "/opt/proxy/watch";
const LOG = DIR + "/asset.jsonl";
const STATUS = DIR + "/status.json";
const NGINX_ERROR = "/var/log/nginx/error.log";
const NGINX_ACCESS = "/var/log/nginx/access.log";
const PROBE_ENABLED = process.env.ANIZIUM_WATCH_PROBE !== "0";
const PROBE_INTERVAL_MS = Number(process.env.ANIZIUM_WATCH_PROBE_INTERVAL_MS) || 5 * 60_000;
const WINDOW_MS = 15 * 60_000;

const startedAt = Date.now();
let logOffset = 0;
let partial = "";
let events = [];
let active = new Map();
let lastOpen = null;
let lastProbe = null;
let probeTimer = null;
let nginxOffset = 0;
let nginxPremature = [];
let accessOffset = 0;
let apiEvents = [];
let assetStatusEvents = [];

try {
  fs.mkdirSync(DIR, { recursive: true });
  logOffset = fs.statSync(LOG).size;
} catch {}
try {
  nginxOffset = fs.statSync(NGINX_ERROR).size;
} catch {}
try {
  accessOffset = fs.statSync(NGINX_ACCESS).size;
} catch {}

function readNewLines() {
  let stat;
  try {
    stat = fs.statSync(LOG);
  } catch {
    return;
  }
  if (stat.size < logOffset) {
    logOffset = 0;
    partial = "";
  }
  if (stat.size === logOffset) return;
  const fd = fs.openSync(LOG, "r");
  const buf = Buffer.alloc(stat.size - logOffset);
  fs.readSync(fd, buf, 0, buf.length, logOffset);
  fs.closeSync(fd);
  logOffset = stat.size;
  partial += buf.toString("utf8");
  const lines = partial.split("\n");
  partial = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      handle(JSON.parse(line));
    } catch {}
  }
}

function handle(e) {
  e.seenAt = Date.now();
  events.push(e);
  if (e.type === "open") {
    active.set(e.id, { ...e, startedAt: e.seenAt, sent: 0, lastProgressAt: e.seenAt });
    lastOpen = e;
  } else if (e.type === "close") {
    active.delete(e.id);
  } else {
    const item = active.get(e.id);
    if (item) {
      if (typeof e.sent === "number") item.sent = Math.max(item.sent || 0, e.sent);
      if (e.type === "progress" || e.type === "resumed") item.lastProgressAt = e.seenAt;
    }
  }
}

function readNginxErrors() {
  let stat;
  try {
    stat = fs.statSync(NGINX_ERROR);
  } catch {
    return;
  }
  if (stat.size < nginxOffset) nginxOffset = 0;
  if (stat.size === nginxOffset) return;
  const fd = fs.openSync(NGINX_ERROR, "r");
  const buf = Buffer.alloc(stat.size - nginxOffset);
  fs.readSync(fd, buf, 0, buf.length, nginxOffset);
  fs.closeSync(fd);
  nginxOffset = stat.size;
  const cutoff = Date.now() - 60 * 60_000;
  for (const line of buf.toString("utf8").split("\n")) {
    if (!line.includes("prematurely closed connection")) continue;
    if (!line.includes("video.calium.fun")) continue;
    const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(line);
    const ts = match
      ? Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6])
      : Date.now();
    if (ts >= cutoff) nginxPremature.push(ts);
  }
  nginxPremature = nginxPremature.filter((ts) => ts >= cutoff);
}

function readNginxAccess() {
  let stat;
  try {
    stat = fs.statSync(NGINX_ACCESS);
  } catch {
    return;
  }
  if (stat.size < accessOffset) accessOffset = 0;
  if (stat.size === accessOffset) return;
  const start = accessOffset;
  const length = Math.min(stat.size - start, 2 * 1024 * 1024);
  const fd = fs.openSync(NGINX_ACCESS, "r");
  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, start);
  fs.closeSync(fd);
  accessOffset = start + length;
  const cutoff = Date.now() - 60 * 60_000;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  for (const line of buf.toString("utf8").split("\n")) {
    if (!line.includes("/api/anizium/")) continue;
    const match = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) /.exec(line);
    if (!match) continue;
    const [, , time, method, path, statusText] = match;
    const status = Number(statusText);
    const tm = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/.exec(time);
    const ts = tm
      ? Date.UTC(+tm[3], months[tm[2]] ?? 0, +tm[1], +tm[4], +tm[5], +tm[6])
      : Date.now();
    if (ts < cutoff) continue;
    if (path.startsWith("/api/anizium/episode")) {
      apiEvents.push({ ts, path, status });
    } else if (path.startsWith("/api/anizium/asset")) {
      if (status === 429 || status >= 500) assetStatusEvents.push({ ts, path, status });
    }
  }
  apiEvents = apiEvents.filter((e) => e.ts >= cutoff);
  assetStatusEvents = assetStatusEvents.filter((e) => e.ts >= cutoff);
}

function summarize() {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  events = events.filter((e) => (e.ts || e.seenAt) >= cutoff);
  const opens = events.filter((e) => e.type === "open").length;
  const closes = events.filter((e) => e.type === "close");
  const count = (type) => events.filter((e) => e.type === type).length;
  const bytes = closes.reduce((sum, e) => sum + (e.sent || 0), 0);
  return {
    opens,
    closes: closes.length,
    ok: closes.filter((e) => e.outcome === "ok").length,
    clientAborts: closes.filter((e) => e.outcome === "client_abort").length,
    streamLost: closes.filter((e) => e.outcome === "stream_lost" || e.outcome === "resume_failed").length,
    reconnects: count("reconnect"),
    resumed: count("resumed"),
    idleTimeouts: count("idle"),
    rateLimits: count("rate_limit"),
    bytes,
  };
}

function writeStatus() {
  const now = Date.now();
  readNewLines();
  readNginxErrors();
  readNginxAccess();
  for (const [id, item] of active) {
    if (now - item.startedAt > 30 * 60_000) active.delete(id);
  }
  const last = events[events.length - 1] || null;
  const apiRequests = apiEvents.length;
  const apiFailures = apiEvents.filter((e) => e.status >= 400);
  const status = {
    updatedAt: new Date(now).toISOString(),
    uptimeSec: Math.floor((now - startedAt) / 1000),
    windowMinutes: WINDOW_MS / 60_000,
    stats: summarize(),
    active: [...active.values()].map((item) => ({
      id: item.id,
      host: item.host,
      path: item.path,
      ageSec: Math.max(0, Math.floor((now - item.startedAt) / 1000)),
      sent: item.sent || 0,
      expected: item.expected ?? null,
      stalledSec: Math.max(0, Math.floor((now - (item.lastProgressAt || item.startedAt)) / 1000)),
      account: item.account,
      egress: item.egress,
    })),
    nginxPrematureLastHour: nginxPremature.length,
    episodeApiLastHour: {
      requests: apiRequests,
      failures: apiFailures.length,
      lastFailure: apiFailures.length
        ? {
            at: new Date(apiFailures[apiFailures.length - 1].ts).toISOString(),
            status: apiFailures[apiFailures.length - 1].status,
            path: apiFailures[apiFailures.length - 1].path,
          }
        : null,
    },
    assetHttpErrorsLastHour: {
      count: assetStatusEvents.length,
      last: assetStatusEvents.length
        ? {
            at: new Date(assetStatusEvents[assetStatusEvents.length - 1].ts).toISOString(),
            status: assetStatusEvents[assetStatusEvents.length - 1].status,
          }
        : null,
    },
    lastOpen: lastOpen
      ? {
          at: new Date(lastOpen.ts).toISOString(),
          host: lastOpen.host,
          path: lastOpen.path,
          status: lastOpen.status,
          account: lastOpen.account,
          egress: lastOpen.egress,
        }
      : null,
    lastProbe,
    lastEvent: last
      ? { at: new Date(last.seenAt).toISOString(), type: last.type, path: last.path, outcome: last.outcome }
      : null,
  };
  try {
    fs.writeFileSync(STATUS + ".tmp", JSON.stringify(status, null, 2));
    fs.renameSync(STATUS + ".tmp", STATUS);
  } catch {}
}

function probe() {
  if (!PROBE_ENABLED) return;
  if (active.size > 0) return;
  if (!lastOpen || !lastOpen.host || !lastOpen.path) return;
  if (Date.now() - lastOpen.ts < 60_000) return;
  if (lastProbe && Date.now() - Date.parse(lastProbe.at) < PROBE_INTERVAL_MS) return;

  const target = `https://${lastOpen.host}${lastOpen.path}`;
  const url = `https://video.calium.fun/api/anizium/asset?url=${encodeURIComponent(target)}`;
  const started = Date.now();
  const req = https.request(
    url,
    { method: "GET", headers: { Range: "bytes=0-0" }, timeout: 12_000 },
    (res) => {
      res.resume();
      lastProbe = {
        at: new Date().toISOString(),
        path: lastOpen.path,
        status: res.statusCode,
        retryAfter: res.headers["retry-after"] ?? null,
        ms: Date.now() - started,
      };
      writeStatus();
    }
  );
  req.on("timeout", () => {
    lastProbe = {
      at: new Date().toISOString(),
      path: lastOpen.path,
      status: "timeout",
      ms: Date.now() - started,
    };
    req.destroy();
  });
  req.on("error", (error) => {
    lastProbe = {
      at: new Date().toISOString(),
      path: lastOpen.path,
      status: "error",
      error: error.message,
      ms: Date.now() - started,
    };
  });
  req.end();
}

setInterval(writeStatus, 5_000);
setInterval(readNginxErrors, 10_000);

probeTimer = setInterval(probe, 30_000);
setTimeout(probe, 10_000);

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
