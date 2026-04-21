import { NextResponse } from "next/server";
import { getTop, getAnimeDetails } from "@/lib/anizium/endpoints";

const PRESET_LIMIT = 4;
const AVATAR_LIMIT = 32;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get("animeId")?.trim();

  try {
    if (animeId) {
      const details = await getAnimeDetails(animeId);
      const avatars = (details.data.avatar ?? [])
        .filter((a) => a.link)
        .map((a) => ({ ID: String(a.ID), name: a.name, link: a.link }));
      return NextResponse.json({ success: true, avatars, source: details.data.name });
    }

    const top = await getTop(1);
    const ids = top.page.data.slice(0, PRESET_LIMIT).map((a) => a.ID);

    const details = await Promise.all(
      ids.map((id) =>
        getAnimeDetails(id)
          .then((res) => res.data.avatar ?? [])
          .catch(() => [])
      )
    );

    const seen = new Set<string>();
    const avatars: { ID: string; name: string; link: string | null }[] = [];

    for (const list of details) {
      for (const char of list) {
        if (!char.link) continue;
        if (seen.has(char.link)) continue;
        seen.add(char.link);
        avatars.push({ ID: String(char.ID), name: char.name, link: char.link });
        if (avatars.length >= AVATAR_LIMIT) break;
      }
      if (avatars.length >= AVATAR_LIMIT) break;
    }

    return NextResponse.json({ success: true, avatars });
  } catch (e) {
    const msg = (e as Error)?.message ?? "Bilinmeyen hata";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
