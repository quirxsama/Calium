import { NextRequest, NextResponse } from "next/server";
import { getTMDBCredits } from "@/lib/anizium/endpoints";

export async function GET(req: NextRequest) {
  const tmdbId = req.nextUrl.searchParams.get("tmdb_id");
  if (!tmdbId || !Number.isFinite(Number(tmdbId))) {
    return NextResponse.json(
      { success: false, error: "tmdb_id gerekli", cast: [] },
      { status: 400 }
    );
  }
  try {
    const data = await getTMDBCredits(Number(tmdbId));
    return NextResponse.json({ success: true, cast: data.cast });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message, cast: [] },
      { status: 502 }
    );
  }
}
