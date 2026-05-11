import {
  getLatestEpisodes,
  getTop,
  getCatalog,
  getAnimeDetails,
} from "@/lib/anizium/endpoints";
import { GENRES } from "@/lib/anizium/constants";
import { HeroCarousel, type HeroItem } from "@/components/anime/hero-carousel";
import { AnimeRail } from "@/components/anime/rail";
import { ContinueWatching } from "@/components/anime/continue-watching";
import { EngagementPanels } from "@/components/discovery/engagement-panels";
import { PersonalRecommendationsRail } from "@/components/discovery/personal-recommendations-rail";
import type { AnimeData, ApiResponse, LatestEpisodeData, LatestEpisodeResponse } from "@/lib/anizium/schemas";

function latestToAnime(list: LatestEpisodeData[]): AnimeData[] {
  return list.map((e) => ({
    ID: e.ID,
    name: e.name,
    poster: e.poster ?? null,
    overview: null,
    imdb_point: null,
    type: e.season ? `S${e.season} · B${e.episode ?? ""}` : null,
    genre: [],
  }));
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const EMPTY_PAGE = {
  success: true,
  page: {
    page: 1,
    per_page_items: 0,
    previous_page: null,
    next_page: null,
    total_pages: 0,
    data: [] as AnimeData[],
  },
};

const EMPTY_LATEST = {
  success: true,
  page: { data: [] as LatestEpisodeData[], page: 1, total_pages: 0 },
};

const RAIL_PAGE_COUNT = 3;

function uniqueById<T extends { ID: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.ID)) return false;
    seen.add(item.ID);
    return true;
  });
}

function mergeAnimePages(pages: ApiResponse[]): ApiResponse {
  const first = pages[0] ?? EMPTY_PAGE;
  return {
    ...first,
    page: {
      ...first.page,
      page: 1,
      data: uniqueById(pages.flatMap((res) => res.page.data)),
      total_pages: Math.max(...pages.map((res) => res.page.total_pages ?? 0), 0),
      next_page: pages.some((res) => res.page.next_page != null) ? 2 : null,
    },
  };
}

function mergeLatestPages(pages: LatestEpisodeResponse[]): LatestEpisodeResponse {
  const first = pages[0] ?? EMPTY_LATEST;
  return {
    ...first,
    page: {
      ...first.page,
      page: 1,
      data: uniqueById(pages.flatMap((res) => res.page.data)),
      total_pages: Math.max(...pages.map((res) => res.page.total_pages ?? 0), 0),
      next_page: pages.some((res) => res.page.next_page != null) ? 2 : null,
    },
  };
}

async function loadRailPages<T>(loader: (page: number) => Promise<T>, fallback: T) {
  return Promise.all(
    Array.from({ length: RAIL_PAGE_COUNT }, (_, index) =>
      safe(() => loader(index + 1), fallback)
    )
  );
}

export const revalidate = 600;

export default async function Home() {
  const [latestPages, topPages, dubPages, actionPages, romancePages, isekaiPages] = await Promise.all([
    loadRailPages((page) => getLatestEpisodes(page), EMPTY_LATEST),
    loadRailPages((page) => getTop(page), EMPTY_PAGE),
    loadRailPages((page) => getCatalog({ kind: "trdub", page }), EMPTY_PAGE),
    loadRailPages((page) => getCatalog({ kind: "genre", id: "62263", page }), EMPTY_PAGE),
    loadRailPages((page) => getCatalog({ kind: "genre", id: "59624", page }), EMPTY_PAGE),
    loadRailPages((page) => getCatalog({ kind: "genre", id: "23813", page }), EMPTY_PAGE),
  ]);

  const latest = mergeLatestPages(latestPages);
  const top = mergeAnimePages(topPages);
  const dub = mergeAnimePages(dubPages);
  const action = mergeAnimePages(actionPages);
  const romance = mergeAnimePages(romancePages);
  const isekai = mergeAnimePages(isekaiPages);

  const latestAnime = latestToAnime(latest.page.data);
  const heroBase = (top.page.data.length ? top.page.data : latestAnime).slice(0, 6);

  // Hero için banner + logo detaylardan gelir; paralel çek, hata halinde temel veriyle devam et.
  const heroDetails = await Promise.all(
    heroBase.map((a) =>
      safe(
        () => getAnimeDetails(a.ID),
        null as Awaited<ReturnType<typeof getAnimeDetails>> | null
      )
    )
  );

  const heroItems: HeroItem[] = heroBase.map((a, i) => {
    const d = heroDetails[i]?.data;
    return {
      ...a,
      overview: a.overview ?? d?.overview ?? null,
      genre: a.genre && a.genre.length ? a.genre : d?.genre ?? [],
      imdb_point: a.imdb_point ?? d?.imdb_point ?? null,
      type: a.type ?? d?.type ?? null,
      banner: d?.details_banner ?? d?.banner ?? null,
      logo: d?.logo ?? null,
      release_year: d?.release_year ?? null,
    };
  });

  return (
    <div className="relative">
      <div className="-mt-16">
        <HeroCarousel items={heroItems} />
      </div>

      {/* Mesh gradient backdrop for rails */}
      <div className="pointer-events-none absolute inset-x-0 top-[70vh] -z-10 h-[60vh] mesh-bg opacity-70" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 md:pt-16">
        <EngagementPanels />

        <ContinueWatching />

        <AnimeRail
          title="Son Eklenen Bölümler"
          items={latestAnime}
          href="/kesfet"
        />

        <PersonalRecommendationsRail />

        <AnimeRail
          title="Top 100"
          items={top.page.data}
          href="/top"
        />
        <AnimeRail
          title="Türkçe Dublaj"
          items={dub.page.data}
          href="/dublaj"
        />
        <AnimeRail
          title="Aksiyon"
          items={action.page.data}
          href={`/tur/${GENRES.find((g) => g.id === "62263")?.slug}`}
        />
        <AnimeRail
          title="Romantizm"
          items={romance.page.data}
          href={`/tur/${GENRES.find((g) => g.id === "59624")?.slug}`}
        />
        <AnimeRail
          title="Isekai"
          items={isekai.page.data}
          href={`/tur/${GENRES.find((g) => g.id === "23813")?.slug}`}
        />
      </div>
    </div>
  );
}
