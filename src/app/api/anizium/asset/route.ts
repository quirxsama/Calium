import { NextRequest, NextResponse } from "next/server";
import { aniziumAssetFetch } from "@/lib/anizium/client";
import { isAniziumAssetUrl } from "@/lib/anizium/asset-proxy";

const ASSET_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

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

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!isAniziumAssetUrl(rawUrl)) {
    return NextResponse.json(
      { success: false, error: "Geçersiz asset URL'i" },
      { status: 400 }
    );
  }

  try {
    const upstream = await aniziumAssetFetch(rawUrl, {
      signal: req.signal,
      headers: req.headers.get("range") ? { range: req.headers.get("range")! } : undefined,
    });

    const targetUrl = new URL(rawUrl);
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

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Asset proxy hatası" },
      { status: 502 }
    );
  }
}
