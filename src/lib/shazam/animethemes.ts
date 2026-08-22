import type { RecognizedSong } from "./recognizer";

/**
 * Multi-source HD Album Cover Art & Track Metadata Resolver:
 * 1. Deezer API (Fastest & most comprehensive anime album cover coverage)
 * 2. iTunes Search API (US & JP store fallback)
 */
export async function fetchTrackMetadata(
  title: string,
  artistHint = ""
): Promise<{ title: string; artist: string; coverUrl: string | null }> {
  const query = [title, artistHint].filter(Boolean).join(" ");

  // 1. Deezer API
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { "User-Agent": "Calium/1.0" },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const track = data.data?.[0];
      if (track) {
        const coverUrl =
          track.album?.cover_big ||
          track.album?.cover_medium ||
          track.album?.cover_xl ||
          track.album?.cover_small ||
          null;

        return {
          title: track.title || title,
          artist: track.artist?.name || artistHint,
          coverUrl,
        };
      }
    }
  } catch (err) {
    console.warn("[Deezer] Search error:", err);
  }

  // 2. iTunes Search API (Standard + Japan store)
  for (const country of ["", "JP", "US"]) {
    try {
      const countryParam = country ? `&country=${country}` : "";
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          query
        )}&entity=song&limit=1${countryParam}`,
        {
          headers: { "User-Agent": "Calium/1.0" },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const track = data.results?.[0];
        if (track && track.trackName) {
          let coverUrl = track.artworkUrl100 || null;
          if (coverUrl && typeof coverUrl === "string") {
            coverUrl = coverUrl.replace(
              /100x100bb\.(jpg|png|webp)/,
              "600x600bb.$1"
            );
          }
          return {
            title: track.trackName || title,
            artist: track.artistName || artistHint,
            coverUrl,
          };
        }
      }
    } catch (err) {
      console.warn(`[iTunes] Search error (country=${country}):`, err);
    }
  }

  return { title, artist: artistHint, coverUrl: null };
}

/**
 * Parse episode range string like "1-15", "16-24", "1, 3, 5"
 */
function episodeMatchesRange(epRange: string, episodeNum: number): boolean {
  const parts = epRange.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        if (episodeNum >= start && episodeNum <= end) return true;
      }
    } else {
      const num = Number(part);
      if (Number.isFinite(num) && num === episodeNum) return true;
    }
  }
  return false;
}

interface AnimeThemeEntry {
  episodes?: string;
}

interface AnimeThemeSong {
  title?: string;
  artists?: Array<{ name: string }>;
}

interface AnimeThemeItem {
  type?: string;
  slug?: string;
  song?: AnimeThemeSong;
  animethemeentries?: AnimeThemeEntry[];
}

interface AnimeImage {
  link?: string;
}

interface AnimeThemesAnime {
  name: string;
  slug: string;
  animethemes?: AnimeThemeItem[];
  images?: AnimeImage[];
}

/**
 * Search official Anime Opening song via AnimeThemes API with Deezer/iTunes Cover Art
 */
export async function searchAnimeTheme(
  animeName: string,
  episodeNum?: number
): Promise<RecognizedSong | null> {
  if (!animeName || !animeName.trim()) return null;

  try {
    const cleanName = animeName
      .replace(/\(TV\)/gi, "")
      .replace(/Season\s*\d+/gi, "")
      .replace(/Sezon\s*\d+/gi, "")
      .replace(/\b(2nd|3rd|4th|5th)\s*Season\b/gi, "")
      .replace(/[-_:]/g, " ")
      .trim();

    let matchedAnime: AnimeThemesAnime | null = null;

    // 1. Direct name filter (En hızlı ve kesin eşleşme)
    try {
      const url = `https://api.animethemes.moe/anime?filter[name]=${encodeURIComponent(
        cleanName
      )}&include=animethemes.song.artists,animethemes.animethemeentries,images`;

      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Calium/1.0",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.anime && data.anime.length > 0) {
          matchedAnime = data.anime[0];
        }
      }
    } catch {}

    // 2. Fulltext search fallback (İngilizce/alternatif başlıklar için)
    if (!matchedAnime) {
      try {
        const sUrl = `https://api.animethemes.moe/search?q=${encodeURIComponent(
          cleanName
        )}&fields[search]=anime`;

        const sRes = await fetch(sUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Calium/1.0",
          },
        });

        if (sRes.ok) {
          const sData = await sRes.json();
          const list = sData.search?.anime || [];
          if (list.length > 0) {
            // Find best candidate
            const target =
              list.find(
                (a: { name: string }) =>
                  !a.name.toLowerCase().includes("movie") &&
                  !a.name.toLowerCase().includes("chronicle") &&
                  !a.name.toLowerCase().includes("onigiri")
              ) || list[0];

            if (target?.slug) {
              const aUrl = `https://api.animethemes.moe/anime/${target.slug}?include=animethemes.song.artists,animethemes.animethemeentries,images`;
              const aRes = await fetch(aUrl, {
                headers: {
                  Accept: "application/json",
                  "User-Agent": "Calium/1.0",
                },
              });
              if (aRes.ok) {
                const aData = await aRes.json();
                matchedAnime = aData.anime;
              }
            }
          }
        }
      } catch {}
    }

    if (!matchedAnime) return null;

    const openings = (matchedAnime.animethemes || []).filter(
      (theme: { type?: string }) => theme.type === "OP"
    );

    if (openings.length === 0) return null;

    let matchedOp = openings[0];

    // Episode number matching
    if (episodeNum && Number.isFinite(episodeNum)) {
      for (const op of openings) {
        const entries = op.animethemeentries || [];
        const hasMatch = entries.some((entry: { episodes?: string }) => {
          if (!entry.episodes) return true;
          return episodeMatchesRange(entry.episodes, episodeNum);
        });
        if (hasMatch) {
          matchedOp = op;
          break;
        }
      }
    }

    const songTitle = matchedOp.song?.title;
    if (!songTitle) return null;

    // Retrieve HD Album Cover and Official Artist through Deezer / iTunes
    const meta = await fetchTrackMetadata(songTitle);
    const finalTitle = meta.title || songTitle;
    const finalArtist = meta.artist || "";

    // Fallback to AnimeThemes anime image if Deezer/iTunes returned no cover
    let coverUrl = meta.coverUrl;
    if (!coverUrl && matchedAnime.images && matchedAnime.images.length > 0) {
      coverUrl = matchedAnime.images[0].link || null;
    }

    const searchQuery = [finalArtist, finalTitle].filter(Boolean).join(" ");
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`;

    return {
      title: finalTitle,
      artist: finalArtist,
      coverUrl,
      spotifyUrl,
    };
  } catch (e) {
    console.warn("[AnimeThemes] Theme lookup error:", e);
    return null;
  }
}
