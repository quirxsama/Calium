import type { NextRequest } from "next/server";

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

export type RateLimitOptions = {
  bucket?: string;
  windowMs?: number;
  max?: number;
};

/**
 * IP tabanlı in-memory rate limit. Aynı process'te birden fazla bucket paralel çalışır.
 * Not: Tek-process'tir; çok örnekli deploy'da Redis/Upstash gibi ortak bir store gerekir.
 */
export function rateLimit(
  ip: string,
  opts: RateLimitOptions = {}
): { ok: boolean; remaining: number } {
  const bucket = opts.bucket ?? "default";
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 10;

  let store = stores.get(bucket);
  if (!store) {
    store = new Map();
    stores.set(bucket, store);
  }

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: max - entry.count };
}

/**
 * Client IP'yi request'ten alır. Default olarak `x-forwarded-for`'u güvenmez;
 * `TRUST_PROXY=1` ortam değişkeni set edildiğinde (nginx vb. arkasında) XFF'in
 * ilk girdisini kullanır. Aksi halde remote addr'e düşer, o da yoksa "unknown".
 */
export function getClientIp(req: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  // Next.js edge/runtime'da bazen mevcut olur
  const rawIp = (req as unknown as { ip?: string }).ip;
  if (rawIp) return rawIp;
  return "unknown";
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const store of stores.values()) {
      for (const [key, val] of store) {
        if (now > val.resetAt) store.delete(key);
      }
    }
  }, 5 * 60_000);
}
