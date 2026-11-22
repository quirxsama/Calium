import {
  ANIZIUM_API_BASE_URL,
  CF_CONTROL,
  ORIGIN,
  USER_AGENT,
  USER_SESSION,
  WORKER_URL,
  PROXY_KEY,
} from "./constants";
import { isAniziumAssetUrl } from "./asset-proxy";

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

export type AniziumFetchOpts = {
  revalidate?: number;
  signal?: AbortSignal;
};

export type AniziumAssetFetchOpts = AniziumFetchOpts & {
  headers?: HeadersInit;
};

export type AniziumAssetErrorKind = "invalid" | "timeout" | "aborted" | "upstream" | "network";

export class AniziumAssetError extends Error {
  readonly kind: AniziumAssetErrorKind;
  readonly status?: number;

  constructor(kind: AniziumAssetErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AniziumAssetError";
    this.kind = kind;
    this.status = status;
  }
}

function promptRecoveryProbe(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return;
  const message = error instanceof Error ? error.message : "";
  if (/HTTP (400|404)\b|env değişkenleri zorunlu|Unauthorized|Geçersiz Anizium/.test(message)) return;
  (globalThis as typeof globalThis & {
    __calium_anizium_failure?: () => void;
  }).__calium_anizium_failure?.();
}

export async function aniziumFetch<T = unknown>(
  path: string,
  opts: AniziumFetchOpts = {}
): Promise<T> {
  try {
    return await fetchAnizium<T>(path, opts);
  } catch (error) {
    promptRecoveryProbe(error, opts.signal);
    throw error;
  }
}

async function fetchAnizium<T = unknown>(
  path: string,
  opts: AniziumFetchOpts = {}
): Promise<T> {
  // Cloudflare Worker üzerinden proxy — VPS IP bloklamasını aşar
  if (WORKER_URL) {
    console.info("[anizium] using worker proxy", {
      path,
      hasProxyKey: Boolean(PROXY_KEY),
      revalidate: opts.revalidate,
    });
    return aniziumFetchViaWorker<T>(path, opts);
  }

  const headers = buildHeaders();
  const url = `${ANIZIUM_API_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;
  const controller = new AbortController();
  const signals = [opts.signal, controller.signal].filter(Boolean) as AbortSignal[];
  const combinedSignal = signals.length > 1
    ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any?.(signals) ?? controller.signal
    : (signals[0] ?? controller.signal);
  const to = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers,
      signal: combinedSignal,
      next:
        typeof opts.revalidate === "number"
          ? { revalidate: opts.revalidate }
          : undefined,
      cache: opts.revalidate === 0 ? "no-store" : undefined,
    });

    if (!res.ok) {
      console.warn("[anizium] upstream non-ok response", {
        path,
        url,
        status: res.status,
      });
      throw new Error(`HTTP ${res.status} @ ${url}`);
    }

    return (await res.json()) as T;
  } catch (e) {
    console.warn("[anizium] upstream request failed", {
      path,
      url,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    clearTimeout(to);
  }
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

  try {
    const proxyHeaders: Record<string, string> = {};
    if (PROXY_KEY) proxyHeaders["x-proxy-key"] = PROXY_KEY;
    const res = await fetch(url, {
      headers: proxyHeaders,
      signal: combinedSignal,
      next:
        typeof opts.revalidate === "number"
          ? { revalidate: opts.revalidate }
          : undefined,
      cache: opts.revalidate === 0 ? "no-store" : undefined,
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      console.warn("[anizium] worker non-ok response", {
        path,
        status: res.status,
        error: body.error,
      });
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(to);
  }
}

export async function aniziumAssetFetch(
  assetUrl: string,
  opts: AniziumAssetFetchOpts = {}
): Promise<Response> {
  try {
    return await fetchAniziumAsset(assetUrl, opts);
  } catch (error) {
    promptRecoveryProbe(error, opts.signal);
    throw error;
  }
}

async function fetchAniziumAsset(
  assetUrl: string,
  opts: AniziumAssetFetchOpts = {}
): Promise<Response> {
  if (!isAniziumAssetUrl(assetUrl)) {
    throw new AniziumAssetError("invalid", "Geçersiz Anizium asset URL'i");
  }

  if (WORKER_URL) {
    return aniziumAssetFetchViaWorker(assetUrl, opts);
  }

  const controller = new AbortController();
  const signals = [opts.signal, controller.signal].filter(Boolean) as AbortSignal[];
  const combinedSignal =
    signals.length > 1
      ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any?.(signals) ??
        controller.signal
      : (signals[0] ?? controller.signal);
  let timedOut = false;
  const to = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);

  const headers = new Headers(buildHeaders());
  headers.set("accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,text/vtt,text/plain,*/*;q=0.8");
  headers.set("sec-fetch-dest", "image");
  if (opts.headers) {
    new Headers(opts.headers).forEach((value, key) => headers.set(key, value));
  }

  try {
    const res = await fetch(assetUrl, {
      headers,
      signal: combinedSignal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new AniziumAssetError("upstream", `HTTP ${res.status}`, res.status);
    }
    return res;
  } catch (error) {
    if (error instanceof AniziumAssetError) throw error;
    if (opts.signal?.aborted) {
      throw new AniziumAssetError("aborted", "Asset request aborted");
    }
    if (timedOut) {
      throw new AniziumAssetError("timeout", "Asset upstream timeout");
    }
    throw new AniziumAssetError(
      "network",
      error instanceof Error ? error.message : "Asset upstream error"
    );
  } finally {
    clearTimeout(to);
  }
}

async function aniziumAssetFetchViaWorker(
  assetUrl: string,
  opts: AniziumAssetFetchOpts = {}
): Promise<Response> {
  const url = `${WORKER_URL}/__asset?url=${encodeURIComponent(assetUrl)}`;
  const controller = new AbortController();
  const signals = [opts.signal, controller.signal].filter(Boolean) as AbortSignal[];
  const combinedSignal =
    signals.length > 1
      ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any?.(signals) ??
        controller.signal
      : (signals[0] ?? controller.signal);
  let timedOut = false;
  const to = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);

  const proxyHeaders = new Headers(opts.headers);
  if (PROXY_KEY) proxyHeaders.set("x-proxy-key", PROXY_KEY);

  try {
    const res = await fetch(url, {
      headers: proxyHeaders,
      signal: combinedSignal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new AniziumAssetError("upstream", `HTTP ${res.status}`, res.status);
    }
    return res;
  } catch (error) {
    if (error instanceof AniziumAssetError) throw error;
    if (opts.signal?.aborted) {
      throw new AniziumAssetError("aborted", "Asset request aborted");
    }
    if (timedOut) {
      throw new AniziumAssetError("timeout", "Asset upstream timeout");
    }
    throw new AniziumAssetError(
      "network",
      error instanceof Error ? error.message : "Asset upstream error"
    );
  } finally {
    clearTimeout(to);
  }
}
