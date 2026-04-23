import type { MetadataRoute } from "next";
import {
  getCatalog,
  getLatestEpisodes,
  getTop,
} from "@/lib/anizium/endpoints";
import { getSiteUrl } from "@/lib/site-url";

const publicRoutes = [
  "",
  "/arama",
  "/arkadaslar/public-odalar",
  "/dublaj",
  "/giris",
  "/iletisim",
  "/kayit",
  "/kesfet",
  "/top",
] as const;

const SITEMAP_SOURCE_PAGES = 5;

async function getAnimeDetailRoutes(): Promise<string[]> {
  const animeIds = new Set<string>();

  const sources = await Promise.allSettled([
    ...Array.from({ length: SITEMAP_SOURCE_PAGES }, (_, index) => getTop(index + 1)),
    ...Array.from({ length: SITEMAP_SOURCE_PAGES }, (_, index) =>
      getCatalog({ kind: "series", page: index + 1 })
    ),
    ...Array.from({ length: SITEMAP_SOURCE_PAGES }, (_, index) =>
      getCatalog({ kind: "movie", page: index + 1 })
    ),
    ...Array.from({ length: SITEMAP_SOURCE_PAGES }, (_, index) =>
      getCatalog({ kind: "trdub", page: index + 1 })
    ),
    ...Array.from({ length: SITEMAP_SOURCE_PAGES }, (_, index) =>
      getLatestEpisodes(index + 1)
    ),
  ]);

  for (const source of sources) {
    if (source.status !== "fulfilled") {
      continue;
    }

    for (const item of source.value.page.data) {
      if (item.ID) {
        animeIds.add(String(item.ID));
      }
    }
  }

  return Array.from(animeIds).map((id) => `/anime/${encodeURIComponent(id)}`);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  const animeRoutes = await getAnimeDetailRoutes();

  const routes = [...publicRoutes, ...animeRoutes];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "hourly" : route.startsWith("/anime/") ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/anime/") ? 0.8 : 0.7,
  }));
}
