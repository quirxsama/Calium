import { NextRequest, NextResponse } from "next/server";
import { getEpisodeSources } from "@/lib/anizium/endpoints";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const animeId = sp.get("animeId") ?? "";
  const season = Number(sp.get("season") ?? "0");
  const episode = Number(sp.get("episode") ?? "0");
  if (!animeId || !season || !episode) {
    return NextResponse.json(
      { success: false, error: "animeId, season, episode gerekli", groups: [], subtitles: [] },
      { status: 400 }
    );
  }
  try {
    const data = await getEpisodeSources(animeId, season, episode);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message, groups: [], subtitles: [] },
      { status: 502 }
    );
  }
}
