import { NextRequest, NextResponse } from "next/server";
import { AniziumAssetError, aniziumAssetFetch } from "@/lib/anizium/client";
import { isAniziumAssetUrl } from "@/lib/anizium/asset-proxy";

const ASSET_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const ASSET_IDLE_TIMEOUT_MS = positiveInt(process.env.ANIZIUM_ASSET_IDLE_TIMEOUT_MS, 30_000);

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function inferContentType(pathname: string) {
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

function withIdleTimeout(
  body: ReadableStream<Uint8Array>,
  timeoutMs: number,
  meta: { host: string; path: string }
) {
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (settled) return;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clear();
        console.error("[anizium-asset] body idle timeout", {
          ...meta,
          timeoutMs,
        });
        void reader.cancel(error).catch(() => {});
        controller.error(error);
      };

      clear();
      timer = setTimeout(() => fail(new Error("Asset body idle timeout")), timeoutMs);

      try {
        const { done, value } = await reader.read();
        if (settled) return;
        clear();
        if (done) {
          settled = true;
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        if (settled) return;
        settled = true;
        clear();
        controller.error(error);
      }
    },
    cancel(reason) {
      settled = true;
      clear();
      return reader.cancel(reason);
    },
  });
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!isAniziumAssetUrl(rawUrl)) {
    return NextResponse.json(
      { success: false, error: "Geçersiz asset URL'i" },
      { status: 400 }
    );
  }

  const targetUrl = new URL(rawUrl);

  try {
    const upstream = await aniziumAssetFetch(rawUrl, {
      signal: req.signal,
      headers: req.headers.get("range") ? { range: req.headers.get("range")! } : undefined,
    });

    const headers = new Headers();
    headers.set("Cache-Control", ASSET_CACHE_CONTROL);
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || inferContentType(targetUrl.pathname)
    );
    for (const header of ["content-length", "accept-ranges", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(header);
      if (value) headers.set(header, value);
    }

    const body = upstream.body
      ? withIdleTimeout(upstream.body, ASSET_IDLE_TIMEOUT_MS, {
          host: targetUrl.hostname,
          path: targetUrl.pathname,
        })
      : null;

    return new NextResponse(body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const assetError =
      error instanceof Error && error.name === "AniziumAssetError"
        ? (error as AniziumAssetError)
        : null;
    const kind = assetError?.kind ?? "network";
    const upstreamStatus = assetError?.status;
    const timedOut = kind === "timeout" || upstreamStatus === 408 || upstreamStatus === 504;
    const aborted = kind === "aborted" || req.signal?.aborted;
    const rateLimited = kind === "upstream" && upstreamStatus === 429;
    const status = aborted ? 499 : rateLimited ? 429 : timedOut ? 504 : kind === "invalid" ? 400 : 502;

    const headers = new Headers({ "Cache-Control": "no-store" });
    if (timedOut) headers.set("Retry-After", "5");
    else if (rateLimited) headers.set("Retry-After", "30");

    console.error("[anizium-asset] request failed", {
      host: targetUrl.hostname,
      path: targetUrl.pathname,
      kind,
      upstreamStatus,
      status,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Asset proxy hatası",
      },
      { status, headers }
    );
  }
}
