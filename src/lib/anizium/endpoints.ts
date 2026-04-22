import { aniziumFetch } from "./client";
import { CACHE_TTL } from "./constants";
import {
  ApiResponseSchema,
  AnimeDetailsResponseSchema,
  LatestEpisodeResponseSchema,
  SourceResponseSchema,
  TMDBCreditsSchema,
  type ApiResponse,
  type AnimeDetailsResponse,
  type LatestEpisodeResponse,
  type SourceResponse,
  type TMDBCredits,
} from "./schemas";

// ---- Listeleme endpoint'leri ----

export async function getLatestEpisodes(page = 1): Promise<LatestEpisodeResponse> {
  const raw = await aniziumFetch(`/page/last-added-episodes?page=${page}`, {
    revalidate: CACHE_TTL.latest,
  });
  return LatestEpisodeResponseSchema.parse(raw);
}

export type CatalogKind = "series" | "movie" | "trdub" | "genre";

export async function getCatalog(
  params: { id?: string; kind: CatalogKind; page?: number }
): Promise<ApiResponse> {
  const page = params.page ?? 1;
  let url = "";
  switch (params.kind) {
    case "series":
      url = `/page/catalog?id=series&type=type&page=${page}`;
      break;
    case "movie":
      url = `/page/catalog?id=movie&type=type&page=${page}`;
      break;
    case "trdub":
      url = `/page/catalog?id=trdub&type=sound_group&page=${page}`;
      break;
    case "genre":
      url = `/page/catalog?id=${params.id}&type=genre&page=${page}`;
      break;
  }
  const raw = await aniziumFetch(url, { revalidate: CACHE_TTL.catalog });
  return ApiResponseSchema.parse(raw);
}

export async function getTop(page = 1): Promise<ApiResponse> {
  const raw = await aniziumFetch(
    `/page/top?platform=favorite&page=${page}`,
    { revalidate: CACHE_TTL.top }
  );
  return ApiResponseSchema.parse(raw);
}

export async function getAnimeDetails(id: string): Promise<AnimeDetailsResponse> {
  const raw = await aniziumFetch(`/anime/get?id=${encodeURIComponent(id)}`, {
    revalidate: CACHE_TTL.detail,
  });
  return AnimeDetailsResponseSchema.parse(raw);
}

// ---- Arama (doküman belirsiz — iki varyant dene) ----

function emptySearchResponse(page: number): ApiResponse {
  return {
    success: true,
    page: {
      page,
      per_page_items: 0,
      previous_page: null,
      double_previous_page: null,
      next_page: null,
      double_next_page: null,
      pageless_total: 0,
      not_displayed: 0,
      total_pages: 0,
      data: [],
    },
  } as ApiResponse;
}

async function trySearch(term: string, page: number): Promise<ApiResponse | null> {
  const q = encodeURIComponent(term);
  try {
    const raw = await aniziumFetch(`/page/search?value=${q}&page=${page}`, {
      revalidate: CACHE_TTL.search,
    });
    return ApiResponseSchema.parse(raw);
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    // Anizium "sonuç yok" durumunda HTTP 400 döner — bu bir hata değil, boş sonuç.
    if (msg.includes("HTTP 400")) return null;
    throw e;
  }
}

export async function searchAnime(
  query: string,
  page = 1
): Promise<ApiResponse> {
  const trimmed = query.trim();
  if (!trimmed) return emptySearchResponse(page);

  // Önce tam sorgu ile dene
  const full = await trySearch(trimmed, page);
  if (full) return full;

  // Tam sorgu eşleşmediğinde, en uzun anlamlı kelimeyle tek kelimelik fallback dene
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length > 1) {
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    const fallback = await trySearch(longest, page);
    if (fallback) return fallback;
  }

  return emptySearchResponse(page);
}

// ---- Video kaynakları ----

export async function getEpisodeSources(
  animeId: string,
  season: number,
  episode: number
): Promise<SourceResponse> {
  const raw = await aniziumFetch(
    `/anime/source?id=${encodeURIComponent(animeId)}&season=${season}&episode=${episode}`,
    { revalidate: 0 }
  );
  return SourceResponseSchema.parse(raw);
}

// ---- Benzer animeler ----

export async function getSimilarAnimes(id: string): Promise<ApiResponse> {
  const raw = await aniziumFetch<unknown>(`/anime/similar?id=${encodeURIComponent(id)}`, {
    revalidate: CACHE_TTL.detail,
  });

  // Dokümana göre /anime/similar yanıtı bazı durumlarda
  // { success, data: AnimeData[] } formatında dönebiliyor.
  // Uygulamanın geri kalanı ApiResponse (page.data) beklediği için normalize ediyoruz.
  const parsed = raw as {
    success?: boolean;
    data?: unknown;
    page?: unknown;
  };

  if (!parsed.page && Array.isArray(parsed.data)) {
    return ApiResponseSchema.parse({
      success: parsed.success ?? true,
      page: {
        page: 1,
        per_page_items: parsed.data.length,
        previous_page: null,
        next_page: null,
        total_pages: 1,
        data: parsed.data,
      },
    });
  }

  return ApiResponseSchema.parse(raw);
}

// ---- TMDB Cast / Oyuncular ----

export async function getTMDBCredits(tmdbId: number): Promise<TMDBCredits> {
  const apiKey = process.env.TMDB_API_KEY || "";
  if (!apiKey) throw new Error("TMDB_API_KEY env değişkeni ayarlanmamış");
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}/credits?api_key=${apiKey}&language=en-US`;
  const res = await fetch(url, { next: { revalidate: CACHE_TTL.tmdb } });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  const raw = await res.json();
  return TMDBCreditsSchema.parse(raw);
}
