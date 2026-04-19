interface Env {
  CF_CONTROL: string;
  USER_SESSION: string;
  USER_AGENT: string;
  DOMAIN_LIST_URL: string;
  FALLBACK_DOMAIN: string;
}

let cachedDomains: { list: string[]; at: number } | null = null;
const DOMAIN_CACHE_TTL = 300_000; // 5 dk

async function fetchDomainList(env: Env): Promise<string[]> {
  const now = Date.now();
  if (cachedDomains && now - cachedDomains.at < DOMAIN_CACHE_TTL) {
    return cachedDomains.list;
  }
  try {
    const res = await fetch(env.DOMAIN_LIST_URL);
    if (!res.ok) throw new Error("domain list fetch failed");
    const text = await res.text();
    const list = text
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("http") ? s : `https://${s}`))
      .map((s) => s.replace(/\/$/, ""));
    const unique = Array.from(new Set([...list, env.FALLBACK_DOMAIN]));
    cachedDomains = { list: unique, at: now };
    return unique;
  } catch {
    cachedDomains = { list: [env.FALLBACK_DOMAIN], at: now };
    return [env.FALLBACK_DOMAIN];
  }
}

function buildHeaders(env: Env): Record<string, string> {
  return {
    "cf-control": env.CF_CONTROL,
    "user-agent": env.USER_AGENT,
    accept: "application/json, text/plain, */*",
    "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
    origin: "https://x.anizium.co",
    referer: "https://x.anizium.co/",
    "user-session": env.USER_SESSION,
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const path = url.pathname + url.search;

    const domains = await fetchDomainList(env);
    const headers = buildHeaders(env);

    let lastErr: unknown = null;
    for (const domain of domains) {
      const targetUrl = `${domain}${path.startsWith("/") ? path : "/" + path}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        const res = await fetch(targetUrl, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} @ ${targetUrl}`);
          if (res.status >= 500 || res.status === 403) continue;
          return new Response(
            JSON.stringify({ success: false, error: `HTTP ${res.status}` }),
            {
              status: res.status,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (lastErr as Error)?.message || "All domains failed",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};
