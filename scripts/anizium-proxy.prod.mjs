// Production Anizium proxy: multi-account rotation, per-path 429 cooldown,
// .site <-> .sbs asset host fallback, per-account egress (direct VPS IP first,
// Cloudflare WARP as fallback) and sticky account selection per asset path.
// Credentials come only from env / ANIZIUM_ACCOUNTS(_FILE); never hardcode them here.
import http from "http";
import fs from "node:fs";
import { Readable } from "stream";
import fetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";

// Cloudflare WARP yerel SOCKS5 adresi (4000 portu)
const WARP_PROXY = process.env.WARP_PROXY || "socks5h://127.0.0.1:4000";
const warpAgent = new SocksProxyAgent(WARP_PROXY);

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function retryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1_000, Math.floor(seconds * 1000));
  const at = Date.parse(String(value));
  if (Number.isFinite(at)) return Math.max(1_000, at - Date.now());
  return null;
}

const PORT = process.env.PORT || 3002;
const API_KEY = process.env.PROXY_API_KEY || "";
const ASSET_HEADER_TIMEOUT_MS = positiveInt(process.env.ANIZIUM_ASSET_HEADER_TIMEOUT_MS, 20_000);
const ASSET_IDLE_TIMEOUT_MS = positiveInt(
  process.env.ANIZIUM_PROXY_ASSET_IDLE_TIMEOUT_MS || process.env.ANIZIUM_ASSET_IDLE_TIMEOUT_MS,
  15_000
);
const LOG_REQUESTS = process.env.ANIZIUM_PROXY_LOG_REQUESTS === "1";

const CF_CONTROL = process.env.ANIZIUM_CF_CONTROL || "";

const USER_SESSION = process.env.ANIZIUM_USER_SESSION || "";

const USER_AGENT =
  process.env.ANIZIUM_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const RATE_LIMIT_COOLDOWN_MS = positiveInt(process.env.ANIZIUM_429_COOLDOWN_MS, 30_000);
const RATE_LIMIT_MAX_COOLDOWN_MS = positiveInt(
  process.env.ANIZIUM_429_MAX_COOLDOWN_MS,
  60_000
);
const RATE_LIMIT_WAIT_MS = positiveInt(process.env.ANIZIUM_429_WAIT_MS, 10_000);
const STREAM_RECONNECT_ATTEMPTS = positiveInt(process.env.ANIZIUM_STREAM_RECONNECT_ATTEMPTS, 6);

const WATCH_DIR = process.env.ANIZIUM_WATCH_DIR || "/opt/proxy/watch";
const WATCH_LOG = WATCH_DIR + "/asset.jsonl";
const WATCH_LOG_MAX_BYTES = positiveInt(process.env.ANIZIUM_WATCH_LOG_MAX_BYTES, 50 * 1024 * 1024);
let watchLogSize = 0;
try {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
} catch {}
function audit(event) {
  try {
    const line = JSON.stringify({ ts: Date.now(), ...event }) + "\n";
    watchLogSize += Buffer.byteLength(line);
    if (watchLogSize > WATCH_LOG_MAX_BYTES) {
      watchLogSize = 0;
      try {
        fs.renameSync(WATCH_LOG, WATCH_LOG + ".1");
      } catch {}
    }
    fs.appendFile(WATCH_LOG, line, () => {});
  } catch {}
}

function normalizeAccount(value, index) {
  if (!value || typeof value !== "object") return null;
  const cfControl = String(value.cfControl ?? value.cf_control ?? value["cf-control"] ?? "").trim();
  const userSession = String(value.userSession ?? value.user_session ?? value["user-session"] ?? "").trim();
  const userProfile = String(value.userProfile ?? value.user_profile ?? value["user-profile"] ?? "").trim();
  if (!cfControl || !userSession) return null;
  const viaWarpRaw = value.viaWarp ?? value.via_warp ?? true;
  const viaWarp = !(viaWarpRaw === false || viaWarpRaw === "false");
  return {
    name: String(value.name || `account-${index + 1}`),
    cfControl,
    userSession,
    userProfile,
    userAgent: String(value.userAgent || value.user_agent || USER_AGENT),
    viaWarp,
  };
}

function loadAccounts() {
  let raw = process.env.ANIZIUM_ACCOUNTS;
  const file =
    process.env.ANIZIUM_ACCOUNTS_FILE ||
    (fs.existsSync("/opt/proxy/accounts.json") ? "/opt/proxy/accounts.json" : "");

  if (!raw && file) {
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (error) {
      console.warn("[anizium-proxy] accounts file could not be read", {
        file,
        error: error?.message || String(error),
      });
    }
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.accounts) ? parsed.accounts : [];
      const accounts = list.map(normalizeAccount).filter(Boolean);
      if (accounts.length) return accounts;
      console.warn("[anizium-proxy] ANIZIUM_ACCOUNTS contains no valid accounts; falling back to single account");
    } catch (error) {
      console.warn("[anizium-proxy] ANIZIUM_ACCOUNTS is invalid JSON; falling back to single account", {
        error: error?.message || String(error),
      });
    }
  }

  return [{
    name: "default",
    cfControl: CF_CONTROL,
    userSession: USER_SESSION,
    userProfile: process.env.ANIZIUM_USER_PROFILE || "",
    userAgent: USER_AGENT,
    viaWarp: true,
  }];
}

const ACCOUNTS = loadAccounts();
console.log("[anizium-proxy] account rotation enabled", { accounts: ACCOUNTS.length });
const accountCooldowns = new Map();
// Sticky per-path account selection: a video path keeps the same upstream
// account/egress for consecutive range requests instead of hopping between
// direct and WARP on every request.
const stickyAccounts = new Map();
// 0 disables sticky pinning: Firefox opens several ranges per file and a pinned
// account sees them all at once, which is exactly what triggered the 429 storm.
const STICKY_ACCOUNT_MS = positiveInt(process.env.ANIZIUM_STICKY_ACCOUNT_MS, 0);
const accountStrikes = new Map();
let accountCursor = 0;

function cooldownKey(account, scope) {
  return `${account.name}|${scope}`;
}

function accountEgress(account) {
  return account.viaWarp === false ? "direct" : "warp";
}

function cursorAfter(account) {
  const index = ACCOUNTS.indexOf(account);
  if (index >= 0) accountCursor = (index + 1) % ACCOUNTS.length;
}

function orderedAccounts() {
  const list = [];
  for (let i = 0; i < ACCOUNTS.length; i++) {
    list.push(ACCOUNTS[(accountCursor + i) % ACCOUNTS.length]);
  }
  // Direct egress first; the sort is stable so rotation is preserved per group.
  return list.sort(
    (a, b) => (a.viaWarp === false ? 0 : 1) - (b.viaWarp === false ? 0 : 1)
  );
}

function nextAccount(scope) {
  const now = Date.now();
  for (const account of orderedAccounts()) {
    if ((accountCooldowns.get(cooldownKey(account, scope)) || 0) <= now) {
      cursorAfter(account);
      return account;
    }
  }
  return null;
}

function coolingForAll(account, scopes, now) {
  return scopes.every(
    (scope) => (accountCooldowns.get(cooldownKey(account, scope)) || 0) > now
  );
}

function pickAccountForScopes(scopes) {
  const now = Date.now();

  for (const scope of scopes) {
    const sticky = stickyAccounts.get(scope);
    if (!sticky || sticky.until <= now) continue;
    const account = ACCOUNTS.find((candidate) => candidate.name === sticky.name);
    if (!account) continue;
    if (!coolingForAll(account, scopes, now)) {
      cursorAfter(account);
      return account;
    }
  }

  for (const account of orderedAccounts()) {
    if (!coolingForAll(account, scopes, now)) {
      cursorAfter(account);
      return account;
    }
  }
  return null;
}

function markAccountSuccess(account, scopes) {
  accountStrikes.delete(account.name);
  if (STICKY_ACCOUNT_MS <= 0) return;
  const until = Date.now() + STICKY_ACCOUNT_MS;
  if (stickyAccounts.size > 256) {
    for (const [scope, sticky] of stickyAccounts) {
      if (sticky.until <= Date.now()) stickyAccounts.delete(scope);
    }
  }
  for (const scope of scopes) stickyAccounts.set(scope, { name: account.name, until });
}

function markRateLimited(account, scope, cooldownMs) {
  const strikes = (accountStrikes.get(account.name) || 0) + 1;
  accountStrikes.set(account.name, strikes);
  const backoff = Math.min(
    RATE_LIMIT_MAX_COOLDOWN_MS,
    RATE_LIMIT_COOLDOWN_MS * 2 ** Math.min(strikes - 1, 6)
  );
  const waitMs = cooldownMs ?? backoff;
  accountCooldowns.set(cooldownKey(account, scope), Date.now() + waitMs);
  stickyAccounts.delete(scope);
}

function rateLimitRetryAfter(scope) {
  const now = Date.now();
  let earliest = Infinity;
  for (const account of ACCOUNTS) {
    const until = accountCooldowns.get(cooldownKey(account, scope)) || 0;
    if (until > now && until < earliest) earliest = until;
  }
  return Number.isFinite(earliest) ? Math.max(1, Math.ceil((earliest - now) / 1000)) : 30;
}

const FALLBACK_DOMAIN =
  process.env.ANIZIUM_FALLBACK_DOMAIN || "https://api.anizium.de";

// KRAPTOR123'ün domainListesi anizium için tasarlanmamış (60+ farklı anime/dizi
// sitesi listesi). Her domain 12 sn timeout → toplam 12+ dakika bekleme.
// Patch: liste tamamen devre dışı, sadece FALLBACK_DOMAIN kullanılır.
// İleride anizium'a özel bir domain listesi yayınlanırsa buraya geri bağlanılabilir.
const DOMAIN_LIST_URL = "";

const ORIGIN = "https://x.anizium.de";

const ALLOWED_ASSET_HOSTS = new Set([
  "x.anizium.de",
  "api.anizium.de",
  "anizium.de",
  "x.anizium.co",
  "api.anizium.co",
  "anizium.co",
  "anizium.com",
  "anizium.net",
  "anizium.org",
  "aniziumserver.sbs",
  "aniziumserver.site",
]);

const ASSET_CACHE_CONTROL =
  process.env.ANIZIUM_ASSET_CACHE_CONTROL || "public, max-age=86400, stale-while-revalidate=604800";

let cachedDomains = null;
let cachedAt = 0;
const DOMAIN_TTL = 300_000;

async function fetchDomainList() {
  // Patch: domain listesi kapalı. Sadece FALLBACK_DOMAIN dön.
  if (cachedDomains) return cachedDomains;
  cachedDomains = [FALLBACK_DOMAIN];
  cachedAt = Date.now();
  return cachedDomains;
}

function buildHeaders(account) {
  const headers = {
    "cf-control": account.cfControl,
    "user-agent": account.userAgent || USER_AGENT,
    accept: "application/json, text/plain, */*",
    "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
    origin: ORIGIN,
    referer: `${ORIGIN}/`,
    "user-session": account.userSession,
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };
  if (account.userProfile) headers["user-profile"] = account.userProfile;
  return headers;
}

function isAllowedAssetUrl(url) {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    (ALLOWED_ASSET_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".anizium.de") ||
      url.hostname.endsWith(".anizium.co") ||
      url.hostname.endsWith(".anizium.com") ||
      url.hostname.endsWith(".anizium.net") ||
      url.hostname.endsWith(".anizium.org") ||
      url.hostname.endsWith(".aniziumserver.sbs") ||
      url.hostname.endsWith(".aniziumserver.site"))
  );
}

function buildAssetHeaders(req, account, video) {
  if (video) {
    return {
      ...buildHeaders(account),
      accept: "video/*,*/*;q=0.8",
      "sec-fetch-dest": "video",
    };
  }
  return {
    ...buildHeaders(account),
    accept: req.headers.accept || "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "sec-fetch-dest": "image",
  };
}

function inferContentType(pathname) {
  const ext = pathname.toLowerCase().split(".").pop();
  switch (ext) {
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml; charset=utf-8";
    case "vtt":
      return "text/vtt; charset=utf-8";
    case "srt":
      return "application/x-subrip; charset=utf-8";
    case "ass":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function alternateAssetHost(targetUrl) {
  const alternate = new URL(targetUrl.toString());
  if (alternate.hostname.endsWith(".aniziumserver.site")) {
    alternate.hostname = alternate.hostname.replace(/\.aniziumserver\.site$/, ".aniziumserver.sbs");
  } else if (alternate.hostname.endsWith(".aniziumserver.sbs")) {
    alternate.hostname = alternate.hostname.replace(/\.aniziumserver\.sbs$/, ".aniziumserver.site");
  } else {
    return null;
  }
  return alternate;
}

async function fetchAssetUpstream(targetUrl, req, signal, rangeHeader) {
  const candidates = [targetUrl];
  const alternate = alternateAssetHost(targetUrl);
  if (alternate) candidates.push(alternate);
  const scopes = candidates.map((url) => url.hostname + url.pathname);
  const video = isVideoAsset(targetUrl);
  let waited = false;

  for (;;) {
    const account = pickAccountForScopes(scopes);
    if (!account) {
      const retryAfter = Math.max(1, ...scopes.map((scope) => rateLimitRetryAfter(scope)));
      if (!waited && retryAfter * 1000 <= RATE_LIMIT_WAIT_MS) {
        waited = true;
        console.warn("[anizium-proxy] all accounts cooling; waiting shortly", {
          host: targetUrl.hostname,
          path: targetUrl.pathname,
          retryAfter,
        });
        await sleep(retryAfter * 1000 + 250);
        if (signal?.aborted) throw new Error("request aborted");
        continue;
      }
      return { rateLimited: true, retryAfter };
    }

    let attempted = false;
    const now = Date.now();
    for (const candidate of candidates) {
      const scope = candidate.hostname + candidate.pathname;
      if ((accountCooldowns.get(cooldownKey(account, scope)) || 0) > now) continue;
      attempted = true;

      const headers = buildAssetHeaders(req, account, video);
      const range = rangeHeader ?? req.headers.range;
      if (range) headers.range = range;

      const upstream = await fetch(candidate.toString(), {
        headers,
        signal,
        agent: account.viaWarp === false ? undefined : warpAgent,
      });

      if (upstream.status !== 429) {
        markAccountSuccess(account, [scope]);
        if (candidate.hostname !== targetUrl.hostname) {
          console.log("[anizium-proxy] asset host fallback", {
            account: account.name,
            egress: accountEgress(account),
            from: targetUrl.hostname,
            to: candidate.hostname,
            path: candidate.pathname,
          });
        }
        return { upstream, account, url: candidate };
      }

      const retryAfter = retryAfterMs(upstream.headers.get("retry-after"));
      upstream.body?.destroy?.();
      markRateLimited(account, scope, retryAfter ?? undefined);
      console.warn("[anizium-proxy] asset rate limited; rotating account/host", {
        account: account.name,
        host: candidate.hostname,
        path: candidate.pathname,
        retryAfter: retryAfter ? Math.ceil(retryAfter / 1000) : null,
        strikes: accountStrikes.get(account.name),
      });
    }

    if (!attempted) {
      const retryAfter = Math.max(1, ...scopes.map((scope) => rateLimitRetryAfter(scope)));
      if (!waited && retryAfter * 1000 <= RATE_LIMIT_WAIT_MS) {
        waited = true;
        await sleep(retryAfter * 1000 + 250);
        if (signal?.aborted) throw new Error("request aborted");
        continue;
      }
      return { rateLimited: true, retryAfter };
    }
  }
}

function parseContentRange(value) {
  if (!value) return null;
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(String(value).trim());
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3]),
  };
}

function responseSpan(status, headers) {
  const range = parseContentRange(headers.get("content-range"));
  if (range) return range;
  if (status === 200) {
    const length = Number(headers.get("content-length"));
    if (Number.isFinite(length) && length >= 0) {
      return { start: 0, end: length > 0 ? length - 1 : -1, total: length };
    }
  }
  return null;
}

function isVideoAsset(targetUrl) {
  return /\.(mp4|m4v|webm)$/i.test(targetUrl.pathname);
}

function waitDrain(res) {
  if (!res.writableNeedDrain) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      res.off("drain", done);
      res.off("close", done);
      res.off("error", done);
      resolve();
    };
    res.once("drain", done);
    res.once("close", done);
    res.once("error", done);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function proxyAsset(targetUrl, req, res) {
  if (!isAllowedAssetUrl(targetUrl)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Invalid asset url" }));
    return;
  }

  const startedAt = Date.now();
  const video = isVideoAsset(targetUrl);
  const requestRange = req.headers.range || (video ? "bytes=0-" : undefined);
  const streamId = `${startedAt.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  let clientAborted = false;
  let activeController = null;
  let activeBody = null;
  let headerTimer = null;
  let headerTimedOut = false;
  let idleTimer = null;

  const clearHeaderTimer = () => {
    if (headerTimer) {
      clearTimeout(headerTimer);
      headerTimer = null;
    }
  };
  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
  const abortActive = () => {
    try {
      activeBody?.destroy?.();
    } catch {}
    try {
      activeController?.abort();
    } catch {}
    activeBody = null;
    activeController = null;
  };
  const beginAttempt = (timeoutMs = ASSET_HEADER_TIMEOUT_MS) => {
    clearHeaderTimer();
    activeController = new AbortController();
    headerTimedOut = false;
    headerTimer = setTimeout(() => {
      headerTimedOut = true;
      try {
        activeController?.abort();
      } catch {}
    }, timeoutMs);
    return activeController.signal;
  };
  const armIdleTimer = () => {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (res.writableNeedDrain) {
        armIdleTimer();
        return;
      }
      console.warn("[anizium-proxy] asset body idle timeout", {
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        idleMs: ASSET_IDLE_TIMEOUT_MS,
      });
      audit({
        type: "idle",
        id: streamId,
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        idleMs: ASSET_IDLE_TIMEOUT_MS,
      });
      abortActive();
    }, ASSET_IDLE_TIMEOUT_MS);
  };

  res.on("close", () => {
    if (!res.writableEnded) clientAborted = true;
    clearIdleTimer();
    clearHeaderTimer();
    abortActive();
  });

  const closeStream = (outcome, extra = {}) => {
    clearHeaderTimer();
    clearIdleTimer();
    abortActive();
    if (!res.writableEnded && !res.destroyed) res.end();
    audit({
      type: "close",
      id: streamId,
      host: targetUrl.hostname,
      path: targetUrl.pathname,
      ms: Date.now() - startedAt,
      outcome,
      ...extra,
    });
  };

  try {
    let result = await fetchAssetUpstream(targetUrl, req, beginAttempt(), requestRange);
    clearHeaderTimer();

    if (result.rateLimited) {
      console.warn("[anizium-proxy] asset rate limited: all accounts cooling", {
        host: targetUrl.hostname,
        path: targetUrl.pathname,
      });
      audit({
        type: "rate_limit",
        id: streamId,
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        retryAfter: result.retryAfter ?? 30,
      });
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter ?? 30),
      });
      res.end(JSON.stringify({ success: false, error: "HTTP 429" }));
      return;
    }

    let upstream = result.upstream;
    let account = result.account;
    let sourceUrl = result.url ?? targetUrl;

    console.log("[anizium-proxy] asset served", {
      host: sourceUrl.hostname,
      path: targetUrl.pathname,
      account: account?.name,
      egress: account ? accountEgress(account) : "unknown",
      status: upstream.status,
      range: requestRange || req.headers.range || "full",
      ms: Date.now() - startedAt,
    });

    if (!upstream.ok) {
      upstream.body?.destroy?.();
      console.warn("[anizium-proxy] asset upstream error", {
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        status: upstream.status,
        ms: Date.now() - startedAt,
      });
      const errorHeaders = { "Content-Type": "application/json" };
      if (upstream.status === 429) errorHeaders["Retry-After"] = "30";
      res.writeHead(upstream.status, errorHeaders);
      res.end(JSON.stringify({ success: false, error: `HTTP ${upstream.status}` }));
      return;
    }

    const span = responseSpan(upstream.status, upstream.headers);
    const expected = span ? Math.max(0, span.end - span.start + 1) : null;

    const responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": ASSET_CACHE_CONTROL,
      "Content-Type": upstream.headers.get("content-type") || inferContentType(targetUrl.pathname),
    };
    for (const header of ["content-length", "accept-ranges", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders[header] = value;
    }

    res.writeHead(upstream.status, responseHeaders);

    audit({
      type: "open",
      id: streamId,
      host: sourceUrl.hostname,
      path: targetUrl.pathname,
      range: requestRange || "full",
      account: account?.name,
      egress: account ? accountEgress(account) : "unknown",
      status: upstream.status,
      expected,
    });

    if (!upstream.body) {
      closeStream("empty", { sent: 0, expected });
      return;
    }

    let body = upstream.body;
    activeBody = body;
    let sent = 0;
    let reconnects = 0;
    let lastProgressAudit = 0;
    const maxReconnects = video ? STREAM_RECONNECT_ATTEMPTS : 0;

    for (;;) {
      let streamError = null;
      try {
        armIdleTimer();
        for await (const chunk of body) {
          if (clientAborted || res.destroyed) break;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          let piece = buffer;
          if (expected !== null) {
            const remaining = expected - sent;
            if (remaining <= 0) break;
            if (piece.length > remaining) piece = piece.subarray(0, remaining);
          }
          if (!piece.length) continue;
          if (!res.write(piece)) await waitDrain(res);
          sent += piece.length;
          armIdleTimer();
          const now = Date.now();
          if (video && now - lastProgressAudit >= 5000) {
            lastProgressAudit = now;
            audit({ type: "progress", id: streamId, sent, expected });
          }
        }
      } catch (error) {
        streamError = error;
      }
      clearIdleTimer();

      if (clientAborted || res.destroyed) {
        closeStream("client_abort", { sent, expected, reconnects });
        return;
      }

      if (expected !== null && sent >= expected) {
        closeStream("ok", { sent, expected, reconnects });
        return;
      }

      if (!streamError && expected !== null) {
        streamError = new Error(`upstream ended early (${sent}/${expected})`);
      }

      if (!video || span === null || expected === null || reconnects >= maxReconnects) {
        console.warn("[anizium-proxy] asset stream lost", {
          host: sourceUrl.hostname,
          path: targetUrl.pathname,
          sent,
          expected,
          reconnects,
          error: streamError?.message || "unknown",
        });
        audit({
          type: "stream_lost",
          id: streamId,
          host: sourceUrl.hostname,
          path: targetUrl.pathname,
          sent,
          expected,
          reconnects,
          error: streamError?.message || "unknown",
        });
        closeStream("stream_lost", {
          sent,
          expected,
          reconnects,
          error: streamError?.message || "unknown",
        });
        return;
      }

      reconnects += 1;
      const nextStart = span.start + sent;
      if (nextStart > span.end) {
        closeStream("ok", { sent, expected, reconnects });
        return;
      }
      const nextRange = `bytes=${nextStart}-${span.end}`;
      console.warn("[anizium-proxy] asset stream reconnect", {
        host: sourceUrl.hostname,
        path: targetUrl.pathname,
        sent,
        expected,
        attempt: reconnects,
        nextStart,
        error: streamError?.message || "unknown",
      });
      audit({
        type: "reconnect",
        id: streamId,
        host: sourceUrl.hostname,
        path: targetUrl.pathname,
        attempt: reconnects,
        nextStart,
        sent,
        expected,
        error: streamError?.message || "unknown",
      });

      abortActive();
      let resumed = false;
      for (let tries = 0; tries < 2 && !resumed; tries++) {
        try {
          const reopen = await fetchAssetUpstream(targetUrl, req, beginAttempt(6_000), nextRange);
          clearHeaderTimer();
          if (reopen.rateLimited) {
            await sleep(Math.min(3000, Math.max(500, (reopen.retryAfter ?? 1) * 1000)));
            continue;
          }

          const nextUpstream = reopen.upstream;
          if (!nextUpstream.ok) {
            nextUpstream.body?.destroy?.();
            await sleep(300);
            continue;
          }

          const nextSpan = responseSpan(nextUpstream.status, nextUpstream.headers);
          const valid =
            nextUpstream.status === 206 &&
            nextSpan &&
            nextSpan.start === nextStart &&
            (nextSpan.total === null || span.total === null || nextSpan.total === span.total) &&
            nextSpan.end <= span.end;
          if (!valid) {
            nextUpstream.body?.destroy?.();
            audit({
              type: "resume_mismatch",
              id: streamId,
              host: targetUrl.hostname,
              path: targetUrl.pathname,
              nextStart,
              status: nextUpstream.status,
              nextSpan,
            });
            await sleep(300);
            continue;
          }

          body = nextUpstream.body;
          activeBody = body;
          upstream = nextUpstream;
          account = reopen.account;
          sourceUrl = reopen.url ?? targetUrl;
          resumed = true;
          console.log("[anizium-proxy] asset stream resumed", {
            host: sourceUrl.hostname,
            path: targetUrl.pathname,
            sent,
            nextStart,
            attempt: reconnects,
            account: account?.name,
            egress: account ? accountEgress(account) : "unknown",
          });
          audit({
            type: "resumed",
            id: streamId,
            host: sourceUrl.hostname,
            path: targetUrl.pathname,
            nextStart,
            sent,
            attempt: reconnects,
            account: account?.name,
            egress: account ? accountEgress(account) : "unknown",
          });
        } catch (error) {
          audit({
            type: "resume_error",
            id: streamId,
            host: targetUrl.hostname,
            path: targetUrl.pathname,
            nextStart,
            error: error?.message || String(error),
          });
          await sleep(300);
        }
      }

      if (!resumed) {
        console.warn("[anizium-proxy] asset stream resume failed", {
          host: sourceUrl.hostname,
          path: targetUrl.pathname,
          sent,
          expected,
          reconnects,
        });
        closeStream("resume_failed", { sent, expected, reconnects });
        return;
      }
    }
  } catch (e) {
    clearHeaderTimer();
    clearIdleTimer();
    if (clientAborted || res.destroyed) return;
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = headerTimedOut ? 504 : 502;
    const headers = { "Content-Type": "application/json" };
    if (headerTimedOut) headers["Retry-After"] = "5";
    console.warn("[anizium-proxy] asset failed", {
      host: targetUrl.hostname,
      path: targetUrl.pathname,
      kind: headerTimedOut ? "header_timeout" : "error",
      status,
      ms: Date.now() - startedAt,
      error: e?.message || String(e),
    });
    res.writeHead(status, headers);
    res.end(JSON.stringify({ success: false, error: e?.message || "Asset proxy failed" }));
  } finally {
    clearHeaderTimer();
    clearIdleTimer();
    if (LOG_REQUESTS && res.writableEnded) {
      console.log("[anizium-proxy] asset request", {
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        status: res.statusCode,
        ms: Date.now() - startedAt,
      });
    }
  }
}

async function fetchApiUpstream(url) {
  let apiPath = url;
  try {
    apiPath = new URL(url).pathname;
  } catch {}
  const scope = `api:${apiPath}`;
  for (;;) {
    const account = nextAccount(scope);
    if (!account) return { rateLimited: true, retryAfter: rateLimitRetryAfter(scope) };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const upstream = await fetch(url, {
        headers: buildHeaders(account),
        signal: controller.signal,
        agent: account.viaWarp === false ? undefined : warpAgent,
      });

      if (upstream.status === 429) {
        upstream.body?.destroy?.();
        markRateLimited(account, scope);
        console.warn("[anizium-proxy] api rate limited; rotating account", {
          account: account.name,
          url,
        });
        continue;
      }

      if (!upstream.ok) {
        upstream.body?.destroy?.();
        return { upstream, error: new Error(`HTTP ${upstream.status} @ ${url}`) };
      }

      const contentType = upstream.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await upstream.json()
        : await upstream.text();
      return { upstream, contentType, data };
    } catch (error) {
      return { error };
    } finally {
      clearTimeout(timeout);
    }
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (API_KEY) {
    const key = req.headers["x-proxy-key"];
    if (key !== API_KEY) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
      return;
    }
  }

  if (req.method !== "GET") {
    res.writeHead(405);
    res.end(JSON.stringify({ success: false, error: "Method not allowed" }));
    return;
  }

  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = req.url || "/";

  if (requestUrl.pathname === "/__asset") {
    const rawUrl = requestUrl.searchParams.get("url");
    if (!rawUrl) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "url gerekli" }));
      return;
    }
    await proxyAsset(new URL(rawUrl), req, res);
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    await proxyAsset(new URL(`${ORIGIN}${requestUrl.pathname}${requestUrl.search}`), req, res);
    return;
  }

  res.setHeader("Content-Type", "application/json");

  const domains = await fetchDomainList();

  let lastErr = null;
  for (const domain of domains) {
    const url = `${domain}${path.startsWith("/") ? path : "/" + path}`;
    const result = await fetchApiUpstream(url);

    if (result.rateLimited) {
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter ?? 30),
      });
      res.end(JSON.stringify({ success: false, error: "HTTP 429" }));
      return;
    }

    if (result.error) {
      lastErr = result.error;
      const status = result.upstream?.status;
      if (status && (status >= 500 || status === 403)) continue;
      if (status) {
        res.writeHead(status);
        res.end(JSON.stringify({ success: false, error: lastErr.message }));
        return;
      }
      continue;
    }

    if (result.contentType.includes("application/json")) {
      res.writeHead(200);
      res.end(JSON.stringify(result.data));
    } else {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(result.data);
    }
    return;
  }

  res.writeHead(502);
  res.end(
    JSON.stringify({
      success: false,
      error: lastErr?.message || "All domains failed",
    })
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Anizium proxy running on port ${PORT}`);
});
