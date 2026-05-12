import http from "node:http";

const PORT = Number(process.env.ANIZIUM_PROXY_PORT || process.env.PORT || 8787);
const HOST = process.env.ANIZIUM_PROXY_HOST || "127.0.0.1";
const PROXY_KEY = process.env.ANIZIUM_PROXY_KEY || "";

const DOMAIN_LIST_URL =
  "https://raw.githubusercontent.com/Kraptor123/domainListesi/refs/heads/main/eklenti_domainleri.txt";
const FALLBACK_DOMAIN = process.env.ANIZIUM_FALLBACK_DOMAIN || "https://api.anizium.co";
const CF_CONTROL = process.env.ANIZIUM_CF_CONTROL || "";
const USER_SESSION = process.env.ANIZIUM_USER_SESSION || "";
const USER_AGENT =
  process.env.ANIZIUM_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const ORIGIN = "https://x.anizium.co";
const DOMAIN_CACHE_TTL_MS = Number(process.env.ANIZIUM_DOMAIN_CACHE_TTL_MS || 300_000);

let cachedDomains = { list: [FALLBACK_DOMAIN], at: 0 };

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, x-proxy-key",
  });
  res.end(payload);
}

function buildHeaders() {
  if (!CF_CONTROL || !USER_SESSION) {
    throw new Error("ANIZIUM_CF_CONTROL ve ANIZIUM_USER_SESSION env değişkenleri zorunlu.");
  }

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

async function fetchDomainList() {
  const now = Date.now();
  if (now - cachedDomains.at < DOMAIN_CACHE_TTL_MS) return cachedDomains.list;

  try {
    const response = await fetch(DOMAIN_LIST_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`domain list HTTP ${response.status}`);
    const text = await response.text();
    const list = text
      .split("|")
      .map((domain) => domain.trim())
      .filter(Boolean)
      .map((domain) => (domain.startsWith("http") ? domain : `https://${domain}`))
      .map((domain) => domain.replace(/\/$/, ""));
    cachedDomains = { list: Array.from(new Set([...list, FALLBACK_DOMAIN])), at: now };
  } catch (error) {
    console.error("Domain listesi alınamadı, fallback kullanılacak:", error);
    cachedDomains = { list: [FALLBACK_DOMAIN], at: now };
  }

  return cachedDomains.list;
}

async function fetchUpstream(pathAndQuery) {
  const domains = await fetchDomainList();
  const headers = buildHeaders();
  let lastError = null;

  for (const domain of domains) {
    const upstreamUrl = `${domain}${pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(upstreamUrl, {
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await response.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text };
      }

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} @ ${upstreamUrl}`);
        if (response.status >= 500 || response.status === 403) continue;
        return { status: response.status, body };
      }

      return { status: response.status, body };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Tüm Anizium domainleri başarısız oldu.");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type, x-proxy-key",
        "access-control-allow-methods": "GET, OPTIONS",
      });
      res.end();
      return;
    }

    if (req.method !== "GET") {
      json(res, 405, { error: "Sadece GET desteklenir." });
      return;
    }

    if (req.url === "/health") {
      json(res, 200, { success: true, service: "anizium-proxy" });
      return;
    }

    if (PROXY_KEY && req.headers["x-proxy-key"] !== PROXY_KEY) {
      json(res, 401, { error: "Geçersiz proxy anahtarı." });
      return;
    }

    const { status, body } = await fetchUpstream(req.url || "/");
    json(res, status, body);
  } catch (error) {
    console.error("Proxy isteği başarısız:", error);
    json(res, 502, { error: error instanceof Error ? error.message : "Proxy hatası" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Anizium proxy http://${HOST}:${PORT} üzerinde çalışıyor.`);
});
