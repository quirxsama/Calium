import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAnimeDetails, getEpisodeSources } from "@/lib/anizium/endpoints";
import { recognizeIntroSong } from "@/lib/shazam/recognizer";
import { parseTimeCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const animeId = sp.get("animeId")?.trim() || "";
  let animeName = sp.get("animeName")?.trim() || "";
  const episodeId = sp.get("episodeId")?.trim() || "";
  const season = Number(sp.get("season") ?? "NaN");
  const episode = Number(sp.get("episode") ?? "NaN");
  const introStartParam = sp.get("introStart");
  let streamUrl = sp.get("streamUrl")?.trim() || "";

  if (!animeId || !episodeId) {
    return NextResponse.json(
      { success: false, error: "animeId ve episodeId gerekli" },
      { status: 400 }
    );
  }

  try {
    // 1. Veritabanında daha önce taranmış mı kontrol et
    const existing = await prisma.episodeIntroSong.findUnique({
      where: { episodeId },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        cached: true,
        found: existing.found,
        song: existing.found
          ? {
              title: existing.title,
              artist: existing.artist,
              coverUrl: existing.coverUrl,
              spotifyUrl: existing.spotifyUrl,
            }
          : null,
      });
    }

    // Anime adı yoksa detaylardan çek
    if (!animeName && animeId) {
      try {
        const details = await getAnimeDetails(animeId);
        animeName = details.data?.name || "";
      } catch {
        // ignore
      }
    }

    let introStartSec = 0;
    if (introStartParam != null && introStartParam !== "") {
      const parsed = Number(introStartParam);
      if (!Number.isNaN(parsed)) {
        introStartSec = parsed;
      } else {
        introStartSec = parseTimeCode(introStartParam) ?? 0;
      }
    }

    // 2. streamUrl yoksa Anizium API'den çek
    if (!streamUrl && Number.isFinite(season) && Number.isFinite(episode)) {
      try {
        const sourceData = await getEpisodeSources(animeId, season, episode);
        const openingStart = sourceData.content?.opening?.start;
        if (!introStartSec && openingStart) {
          introStartSec = parseTimeCode(openingStart) ?? 0;
        }

        for (const group of sourceData.groups || []) {
          for (const item of group.items || []) {
            if (item.link) {
              streamUrl = item.link;
              break;
            }
          }
          if (streamUrl) break;
        }
      } catch (e) {
        console.error("[IntroSong] Failed to fetch episode sources:", e);
      }
    }

    // 3. Çok Kademeli (Tier 1: AnimeThemes API -> Tier 2: songrec -> Tier 3: shazamio-core) tarama yap
    const recognition = await recognizeIntroSong(
      streamUrl,
      introStartSec,
      animeName,
      Number.isFinite(episode) ? episode : undefined
    );

    if (recognition.found && recognition.song) {
      const song = recognition.song;
      await prisma.episodeIntroSong.upsert({
        where: { episodeId },
        create: {
          animeId,
          episodeId,
          title: song.title,
          artist: song.artist,
          coverUrl: song.coverUrl,
          spotifyUrl: song.spotifyUrl,
          found: true,
        },
        update: {
          title: song.title,
          artist: song.artist,
          coverUrl: song.coverUrl,
          spotifyUrl: song.spotifyUrl,
          found: true,
        },
      });

      return NextResponse.json({
        success: true,
        cached: false,
        found: true,
        song,
      });
    }

    // Bulunamadıysa bir daha gereksiz yere taranmasın diye DB'ye kaydet
    await prisma.episodeIntroSong.upsert({
      where: { episodeId },
      create: {
        animeId,
        episodeId,
        found: false,
      },
      update: {
        found: false,
      },
    });

    return NextResponse.json({
      success: true,
      cached: false,
      found: false,
      song: null,
    });
  } catch (error) {
    console.error("[IntroSong] Error during recognition:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message, found: false, song: null },
      { status: 500 }
    );
  }
}
