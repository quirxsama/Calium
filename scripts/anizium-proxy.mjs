import http from "http";
import { Readable } from "stream";

const PORT = process.env.PORT || 3002;
const API_KEY = process.env.PROXY_API_KEY || "";

const CF_CONTROL =
  process.env.ANIZIUM_CF_CONTROL ||
  "134e4c040840015655080906544d030f004b4c075b54500f";

const USER_SESSION =
  process.env.ANIZIUM_USER_SESSION ||
  "01570d01545f55510102040f525d390e00094f0556514e2d1d5201580100071e030350115a53534c05550f535143455c085c54101215";

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
]);

const ASSET_CACHE_CONTROL =
  process.env.ANIZIUM_ASSET_CACHE_CONTROL || "public, max-age=86400, stale-while-revalidate=604800";

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
      url.hostname.endsWith(".anizium.org"))
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
  if (!isAllowedAssetUrl(targetUrl)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Invalid asset url" }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers = buildAssetHeaders(req);
    if (req.headers.range) headers.range = req.headers.range;
    const upstream = await fetch(targetUrl, {
      headers,
      signal: controller.signal,
    });

    if (!upstream.ok) {
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: `HTTP ${upstream.status}` }));
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
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: e?.message || "Asset proxy failed" }));
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Basit API key kontrolü
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
      res.end(JSON.stringify({ success: false, error: `HTTP ${upstream.status} @ ${url}` }));
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Anizium proxy running on port ${PORT}`);
});
