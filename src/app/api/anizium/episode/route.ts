import { NextRequest, NextResponse } from "next/server";
import { getEpisodeSources } from "@/lib/anizium/endpoints";
import { toAniziumAssetProxyUrl } from "@/lib/anizium/asset-proxy";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const animeId = sp.get("animeId") ?? "";
  const season = Number(sp.get("season") ?? "NaN");
  const episode = Number(sp.get("episode") ?? "NaN");
  if (!animeId || !Number.isFinite(season) || !Number.isFinite(episode)) {
    return NextResponse.json(
      { success: false, error: "animeId, season, episode gerekli", groups: [], subtitles: [] },
      { status: 400 }
    );
  }
  try {
    const data = await getEpisodeSources(animeId, season, episode);
    return NextResponse.json({
      ...data,
      groups: data.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          // shortcut: MP4 only; HLS requires playlist and segment URL rewriting.
          link: /\.mp4(?:[?#]|$)/i.test(item.link) ? toAniziumAssetProxyUrl(item.link) : item.link,
        })),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message, groups: [], subtitles: [] },
      { status: 502 }
    );
  }
}
