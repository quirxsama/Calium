import http from "http";
import { Readable } from "stream";

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || "127.0.0.1";
const API_KEY = process.env.PROXY_API_KEY || process.env.ANIZIUM_PROXY_KEY || "";

const CF_CONTROL = process.env.ANIZIUM_CF_CONTROL || "";

const USER_SESSION = process.env.ANIZIUM_USER_SESSION || "";

const USER_AGENT =
  process.env.ANIZIUM_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const ANIZIUM_API_BASE_URL = "https://api.anizium.co";

const ORIGIN = "https://x.anizium.co";

const ALLOWED_ASSET_HOSTS = new Set([
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

const ASSET_HEADER_TIMEOUT_MS = positiveInt(process.env.ANIZIUM_ASSET_HEADER_TIMEOUT_MS, 20_000);
const ASSET_IDLE_TIMEOUT_MS = positiveInt(process.env.ANIZIUM_ASSET_IDLE_TIMEOUT_MS, 30_000);
const LOG_REQUESTS = process.env.ANIZIUM_PROXY_LOG_REQUESTS === "1";

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

if (!CF_CONTROL || !USER_SESSION) {
  throw new Error("ANIZIUM_CF_CONTROL ve ANIZIUM_USER_SESSION env değişkenleri zorunlu.");
}

if (!API_KEY) {
  throw new Error("PROXY_API_KEY veya ANIZIUM_PROXY_KEY env değişkeni zorunlu.");
}

function buildHeaders() {
  return {
    "cf-control": CF_CONTROL,
    "user-agent": USER_AGENT,
    accept: "application/json, text/plain, */*",
    "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
    origin: ORIGIN,
    referer: `${ORIGIN}/`,
    "user-session": USER_SESSION,
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };
}

function isAllowedAssetUrl(url) {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    (ALLOWED_ASSET_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".anizium.co") ||
      url.hostname.endsWith(".anizium.com") ||
      url.hostname.endsWith(".anizium.net") ||
      url.hostname.endsWith(".anizium.org") ||
      url.hostname.endsWith(".aniziumserver.sbs") ||
      url.hostname.endsWith(".aniziumserver.site"))
  );
}

function buildAssetHeaders(req) {
  return {
    ...buildHeaders(),
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

async function proxyAsset(targetUrl, req, res) {
  const startedAt = Date.now();

  if (!isAllowedAssetUrl(targetUrl)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Invalid asset url" }));
    return;
  }

  if (LOG_REQUESTS) {
    res.on("finish", () => {
      console.log("[anizium-proxy] asset", {
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        status: res.statusCode,
        ms: Date.now() - startedAt,
      });
    });
  }

  const controller = new AbortController();
  let headerTimedOut = false;
  let clientAborted = false;
  let idleTimer;
  const headerTimer = setTimeout(() => {
    headerTimedOut = true;
    controller.abort();
  }, ASSET_HEADER_TIMEOUT_MS);

  res.on("close", () => {
    clientAborted = !res.writableEnded;
    clearTimeout(idleTimer);
    controller.abort();
  });

  try {
    const headers = buildAssetHeaders(req);
    if (req.headers.range) headers.range = req.headers.range;
    const upstream = await fetch(targetUrl, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(headerTimer);

    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => {});
      const errorHeaders = { "Content-Type": "application/json" };
      if (upstream.status === 429) errorHeaders["Retry-After"] = "30";
      res.writeHead(upstream.status, errorHeaders);
      res.end(JSON.stringify({ success: false, error: `HTTP ${upstream.status}` }));
      console.error("[anizium-proxy] asset upstream error", {
        host: targetUrl.hostname,
        path: targetUrl.pathname,
        status: upstream.status,
        ms: Date.now() - startedAt,
      });
      return;
    }

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
    if (!upstream.body) {
      res.end();
      return;
    }

    const body = Readable.fromWeb(upstream.body);
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (res.writableNeedDrain) {
          armIdleTimer();
          return;
        }
        console.error("[anizium-proxy] asset body idle timeout", {
          host: targetUrl.hostname,
          path: targetUrl.pathname,
          timeoutMs: ASSET_IDLE_TIMEOUT_MS,
        });
        controller.abort();
        body.destroy(new Error("Upstream body idle timeout"));
        if (!res.destroyed) res.destroy();
      }, ASSET_IDLE_TIMEOUT_MS);
    };

    body.on("end", () => clearTimeout(idleTimer));
    body.on("error", (error) => {
      clearTimeout(idleTimer);
      if (!res.destroyed) res.destroy(error);
    });
    armIdleTimer();
    body.pipe(res);
    body.on("data", armIdleTimer);
  } catch (e) {
    clearTimeout(headerTimer);
    clearTimeout(idleTimer);
    if (res.destroyed || clientAborted) return;
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const timeout = headerTimedOut;
    const status = timeout ? 504 : 502;
    const message = timeout ? "Upstream timeout" : e?.message || "Asset proxy failed";
    res.writeHead(status, {
      "Content-Type": "application/json",
      ...(timeout ? { "Retry-After": "5" } : {}),
    });
    res.end(JSON.stringify({ success: false, error: message }));
    console.error("[anizium-proxy] asset failed", {
      host: targetUrl.hostname,
      path: targetUrl.pathname,
      status,
      ms: Date.now() - startedAt,
      error: e?.message || String(e),
    });
  } finally {
    clearTimeout(headerTimer);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const key = req.headers["x-proxy-key"];
  if (key !== API_KEY) {
    res.writeHead(401);
    res.end(JSON.stringify({ success: false, error: "Unauthorized" }));
    return;
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
    let assetUrl;
    try {
      assetUrl = new URL(rawUrl);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid asset url" }));
      return;
    }
    await proxyAsset(assetUrl, req, res);
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    await proxyAsset(new URL(`${ORIGIN}${requestUrl.pathname}${requestUrl.search}`), req, res);
    return;
  }

  res.setHeader("Content-Type", "application/json");

  const headers = buildHeaders();

  const url = `${ANIZIUM_API_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!upstream.ok) {
      res.writeHead(upstream.status);
      res.end(JSON.stringify({ success: false, error: `HTTP ${upstream.status}` }));
      return;
    }

    const data = await upstream.json();
    res.writeHead(200);
    res.end(JSON.stringify(data));
  } catch (e) {
    res.writeHead(502);
    res.end(
      JSON.stringify({
        success: false,
        error: e?.message || "Anizium request failed",
      })
    );
  } finally {
    clearTimeout(timeout);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Anizium proxy running on http://${HOST}:${PORT}`);
});
