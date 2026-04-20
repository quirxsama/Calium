import http from "http";

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

const FALLBACK_DOMAIN =
  process.env.ANIZIUM_FALLBACK_DOMAIN || "https://api.anizium.co";

const DOMAIN_LIST_URL =
  "https://raw.githubusercontent.com/Kraptor123/domainListesi/refs/heads/main/eklenti_domainleri.txt";

const ORIGIN = "https://x.anizium.co";

let cachedDomains = null;
let cachedAt = 0;
const DOMAIN_TTL = 300_000;

async function fetchDomainList() {
  const now = Date.now();
  if (cachedDomains && now - cachedAt < DOMAIN_TTL) return cachedDomains;
  try {
    const res = await fetch(DOMAIN_LIST_URL);
    if (!res.ok) throw new Error("domain list failed");
    const text = await res.text();
    const list = text
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("http") ? s : `https://${s}`))
      .map((s) => s.replace(/\/$/, ""));
    cachedDomains = Array.from(new Set([...list, FALLBACK_DOMAIN]));
    cachedAt = now;
    return cachedDomains;
  } catch {
    cachedDomains = [FALLBACK_DOMAIN];
    cachedAt = Date.now();
    return cachedDomains;
  }
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

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

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

  const path = req.url || "/";
  const domains = await fetchDomainList();
  const headers = buildHeaders();

  let lastErr = null;
  for (const domain of domains) {
    const url = `${domain}${path.startsWith("/") ? path : "/" + path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const upstream = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        lastErr = new Error(`HTTP ${upstream.status} @ ${url}`);
        if (upstream.status >= 500 || upstream.status === 403) continue;
        res.writeHead(upstream.status);
        res.end(JSON.stringify({ success: false, error: lastErr.message }));
        return;
      }

      const data = await upstream.json();
      res.writeHead(200);
      res.end(JSON.stringify(data));
      return;
    } catch (e) {
      lastErr = e;
      continue;
    }
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
