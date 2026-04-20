import {
  CF_CONTROL,
  DOMAIN_LIST_URL,
  FALLBACK_DOMAIN,
  ORIGIN,
  USER_AGENT,
  USER_SESSION,
  CACHE_TTL,
  WORKER_URL,
  PROXY_KEY,
} from "./constants";

function buildHeaders() {
  if (!CF_CONTROL || !USER_SESSION) {
    throw new Error(
      "ANIZIUM_CF_CONTROL ve ANIZIUM_USER_SESSION env değişkenleri zorunlu. `.env.local` dosyasını doldurun."
    );
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
  } satisfies Record<string, string>;
}

let cachedDomains: { list: string[]; at: number } | null = null;

async function fetchDomainList(): Promise<string[]> {
  const now = Date.now();
  if (cachedDomains && now - cachedDomains.at < CACHE_TTL.domain * 1000) {
    return cachedDomains.list;
  }
  try {
    const res = await fetch(DOMAIN_LIST_URL, {
      next: { revalidate: CACHE_TTL.domain },
    });
    if (!res.ok) throw new Error("domain list fetch failed");
    const text = await res.text();
    const list = text
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.startsWith("http") ? s : `https://${s}`))
      .map((s) => s.replace(/\/$/, ""));
    const unique = Array.from(new Set([...list, FALLBACK_DOMAIN]));
    cachedDomains = { list: unique, at: now };
    return unique;
  } catch {
    cachedDomains = { list: [FALLBACK_DOMAIN], at: now };
    return [FALLBACK_DOMAIN];
  }
}

export type AniziumFetchOpts = {
  revalidate?: number;
  signal?: AbortSignal;
};

export async function aniziumFetch<T = unknown>(
  path: string,
  opts: AniziumFetchOpts = {}
): Promise<T> {
  // Cloudflare Worker üzerinden proxy — VPS IP bloklamasını aşar
  if (WORKER_URL) {
    return aniziumFetchViaWorker<T>(path, opts);
  }

  const domains = await fetchDomainList();
  const headers = buildHeaders();
  let lastErr: unknown = null;
  for (const domain of domains) {
    const url = `${domain}${path.startsWith("/") ? path : "/" + path}`;
    try {
      const controller = new AbortController();
      const signals = [opts.signal, controller.signal].filter(Boolean) as AbortSignal[];
      const combinedSignal = signals.length > 1
        ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any?.(signals) ?? controller.signal
        : (signals[0] ?? controller.signal);
      const to = setTimeout(() => controller.abort(), 12_000);
      let res: Response;
      try {
        res = await fetch(url, {
          headers,
          signal: combinedSignal,
          next:
            typeof opts.revalidate === "number"
              ? { revalidate: opts.revalidate }
              : undefined,
          cache: opts.revalidate === 0 ? "no-store" : undefined,
        });
      } finally {
        clearTimeout(to);
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} @ ${url}`);
        if (res.status >= 500 || res.status === 403) continue;
        throw lastErr;
      }
      const data = (await res.json()) as T;
      return data;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr ?? new Error("All anizium domains failed");
}

async function aniziumFetchViaWorker<T = unknown>(
  path: string,
  opts: AniziumFetchOpts = {}
): Promise<T> {
  const url = `${WORKER_URL}${path.startsWith("/") ? path : "/" + path}`;
  const controller = new AbortController();
  const signals = [opts.signal, controller.signal].filter(Boolean) as AbortSignal[];
  const combinedSignal =
    signals.length > 1
      ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any?.(signals) ??
        controller.signal
      : (signals[0] ?? controller.signal);
  const to = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    const proxyHeaders: Record<string, string> = {};
    if (PROXY_KEY) proxyHeaders["x-proxy-key"] = PROXY_KEY;
    res = await fetch(url, {
      headers: proxyHeaders,
      signal: combinedSignal,
      next:
        typeof opts.revalidate === "number"
          ? { revalidate: opts.revalidate }
          : undefined,
      cache: opts.revalidate === 0 ? "no-store" : undefined,
    });
  } finally {
    clearTimeout(to);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as T;
  return data;
}

export { fetchDomainList };
