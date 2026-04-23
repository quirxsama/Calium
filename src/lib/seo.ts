import { getSiteUrl } from "@/lib/site-url";

export const SITE_NAME = "Calium";
export const SITE_TITLE = "Calium | Türkçe Anime İzleme Platformu";
export const SITE_DESCRIPTION =
  "Calium, Türkçe altyazılı ve dublaj anime içeriklerini keşfedebileceğin ücretsiz anime izleme platformudur.";

export const SITE_URL = getSiteUrl();

export const SAME_AS_LINKS = [
  process.env.NEXT_PUBLIC_DISCORD_URL,
  process.env.NEXT_PUBLIC_INSTAGRAM_URL,
  process.env.NEXT_PUBLIC_TIKTOK_URL,
  process.env.NEXT_PUBLIC_X_URL,
  process.env.NEXT_PUBLIC_YOUTUBE_URL,
].filter((value): value is string => Boolean(value));

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
