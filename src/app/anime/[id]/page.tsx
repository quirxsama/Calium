export const dynamic = "force-dynamic";
import Link from "next/link";
import { AniziumImage } from "@/components/anime/anizium-image";
import { notFound } from "next/navigation";
import { getAnimeDetails, getCalendar, getSimilarAnimes, getTMDBCredits } from "@/lib/anizium/endpoints";
import { SeasonTabs } from "@/components/anime/season-tabs";
import { FavoriteButton } from "@/components/anime/favorite-button";
import { AddToListButton } from "@/components/anime/add-to-list-button";
import { LibraryStatusButton } from "@/components/anime/library-status-button";
import { BackButton } from "@/components/anime/back-button";
import { AnimePosterFlip } from "@/components/anime/anime-poster-flip";
import { CastSection } from "@/components/anime/cast-section";
import { CommentThread } from "@/components/comments/comment-thread";
import { RatingWidget } from "@/components/comments/rating-widget";
import { RecommendedAnime } from "@/components/anime/recommended-anime";
import { WatchCta } from "@/components/anime/watch-cta";
import { Star, Calendar } from "lucide-react";
import { GENRES } from "@/lib/anizium/constants";
import { formatAnimeType } from "@/lib/utils";
import type { Metadata } from "next";
import { absoluteUrl, buildBreadcrumbJsonLd, SITE_NAME } from "@/lib/seo";
import {
  formatCalendarDate,
  formatRelativeCalendarDate,
  getCalendarEpisodeLabel,
  getUpcomingCalendarItem,
  toUpcomingEpisodePlaceholder,
} from "@/lib/anizium/calendar";

function normalizeText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function getAnimeTypeLabel(type: string | null | undefined) {
  return normalizeText(formatAnimeType(type ?? "Anime"), "Anime");
}

function getGenreHref(name: string) {
  const matchedGenre = GENRES.find((genre) => genre.name === name);

  if (matchedGenre) {
    return `/tur/${matchedGenre.slug}`;
  }

  return "/kesfet";
}


function truncateAtWordBoundary(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength + 1);
  const lastSpaceIndex = sliced.lastIndexOf(" ");

  if (lastSpaceIndex < maxLength * 0.6) {
    return `${text.slice(0, maxLength).trim()}…`;
  }

  return `${sliced.slice(0, lastSpaceIndex).trim()}…`;
}

function buildAnimeDescription(details: {
  name: string;
  overview?: string | null;
  type?: string | null;
  release_year?: string | number | null;
  genre?: Array<{ name: string }>;
}) {
  const genreText = (details.genre ?? [])
    .map((genre) => genre.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const typeText = getAnimeTypeLabel(details.type);
  const introParts = [
    details.name,
    details.release_year ? `${details.release_year} yapımı` : null,
    `bir ${typeText.toLowerCase()}`,
  ].filter(Boolean);
  const summary = normalizeText(
    details.overview,
    `${details.name} hakkında detaylar, bölümler ve izleme bilgileri ${SITE_NAME}'da seni bekliyor.`
  );

  return truncateAtWordBoundary(
    [
      `${introParts.join(" ")}.${genreText ? ` Öne çıkan türleri: ${genreText}.` : ""}`,
      summary,
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    300
  )
    .replace(/\s+/g, " ")
    .trim();
}

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await getAnimeDetails(id);
    const details = res.data;
    const description = buildAnimeDescription(details);
    const title = `${details.name} izle | Konusu, bölümleri ve detayları | ${SITE_NAME}`;
    const canonicalPath = `/anime/${encodeURIComponent(id)}`;
    const image = details.poster ?? details.details_banner ?? details.banner ?? "/icon.webp";

    return {
      title,
      description,
      keywords: [
        details.name,
        `${details.name} izle`,
        `${details.name} konusu`,
        `${details.name} bölümleri`,
        ...(details.genre ?? []).map((genre) => genre.name),
      ],
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        type: "website",
        url: canonicalPath,
        title,
        description,
        siteName: SITE_NAME,
        images: [{ url: image, alt: details.name }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: `Anime izle | ${SITE_NAME}`,
      description: `${SITE_NAME} üzerinde anime detayları, bölümler ve izleme seçeneklerini keşfet.`,
    };
  }
}

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let details;
  let similar: Awaited<ReturnType<typeof getSimilarAnimes>> | null = null;
  let calendar: Awaited<ReturnType<typeof getCalendar>> | null = null;
  try {
    const [detailsRes, similarRes, calendarRes] = await Promise.all([
      getAnimeDetails(id),
      getSimilarAnimes(id).catch(() => null),
      getCalendar().catch(() => null),
    ]);
    details = detailsRes.data;
    similar = similarRes;
    calendar = calendarRes;
  } catch {
    notFound();
  }

  let tmdbCast: Awaited<ReturnType<typeof getTMDBCredits>>["cast"] | null = null;
  if (details.tmdb_id) {
    const tmdbId = Number(details.tmdb_id);
    if (!isNaN(tmdbId) && tmdbId > 0) {
      try {
        tmdbCast = (await getTMDBCredits(tmdbId)).cast;
      } catch {
        tmdbCast = null;
      }
    }
  }

  const firstEp = details.seasons?.[0]?.episodes?.[0];
  const lastSeason = details.seasons?.[details.seasons.length - 1];
  const lastEp = lastSeason?.episodes?.[lastSeason.episodes.length - 1];
  const isMovie = details.type && ["movie", "film"].includes(details.type.toLowerCase().trim());
  const rating = details.imdb_point ? Number(details.imdb_point) : null;
  const genres = details.genre ?? [];
  const genreLinks = genres.slice(0, 3);
  const description = buildAnimeDescription(details);
  const animeUrl = absoluteUrl(`/anime/${encodeURIComponent(details.ID)}`);
  const imageUrl = details.poster ?? details.details_banner ?? details.banner ?? absoluteUrl("/icon.webp");
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Ana Sayfa", path: "/" },
    { name: "Animeler", path: "/kesfet" },
    { name: details.name, path: `/anime/${encodeURIComponent(details.ID)}` },
  ]);
  const animeJsonLd = {
    "@context": "https://schema.org",
    "@type": isMovie ? "Movie" : "TVSeries",
    name: details.name,
    url: animeUrl,
    description,
    image: [imageUrl],
    genre: genres.map((genre) => genre.name),
    datePublished: details.release_year ? String(details.release_year) : undefined,
    aggregateRating:
      rating && rating > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            bestRating: "10",
            worstRating: "0",
          }
        : undefined,
  };
  const upcomingCalendarItem = getUpcomingCalendarItem(
    calendar?.data.flatMap((day) => day.contents) ?? [],
    details.ID,
    details.seasons ?? []
  );

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(animeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Banner */}
      <div className="relative h-[55vh] min-h-[360px] w-full overflow-hidden">
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
          <BackButton />
        </div>
        {details.details_banner ? (
          <AniziumImage
            src={details.details_banner}
            alt={details.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[var(--muted)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/60 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 -mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {details.poster && (
            <div className="relative">
              {details.youtube_video ? (
                <AnimePosterFlip
                  poster={details.poster}
                  youtubeUrl={details.youtube_video}
                  alt={details.name}
                />
              ) : (
                <div className="relative aspect-[2/3] w-[160px] md:w-[224px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl">
                  <AniziumImage src={details.poster} alt={details.name} fill sizes="240px" className="object-cover" />
                </div>
              )}
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow">
              {details.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
              {rating && rating > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-[var(--foreground)] font-semibold">{rating.toFixed(1)}</span>
                  <span>/ 10</span>
                </span>
              )}
              {details.release_year && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {details.release_year}
                </span>
              )}
              {details.type && <span className="uppercase tracking-wide">{formatAnimeType(details.type)}</span>}
            </div>

            {details.genre && details.genre.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {details.genre.map((g) => (
                  <span
                    key={g.ID}
                    className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {details.overview && (
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)] md:text-base">
                {details.overview}
              </p>
            )}

            <div className="mt-5">
              <RatingWidget animeId={details.ID} />
            </div>

            {upcomingCalendarItem && (
              <div className="mt-5 max-w-3xl rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
                  Yayın bilgisi
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)] md:text-base">
                  Devam eden animenin {getCalendarEpisodeLabel(upcomingCalendarItem.item)} bölümü {" "}
                  <span className="font-bold">{formatCalendarDate(upcomingCalendarItem.date)}</span> tarihinde ({formatRelativeCalendarDate(upcomingCalendarItem.date)}) yayınlanacak.
                </p>
                <Link
                  href="/yayin-takvimi"
                  className="mt-3 inline-flex text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  Tüm yayın takvimini gör
                </Link>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <WatchCta animeId={details.ID} firstEpisodeId={firstEp?.ID ?? null} isMovie={Boolean(isMovie)} latestEpisodeId={lastEp?.ID ?? null} />
              <LibraryStatusButton
                animeId={details.ID}
                animeName={details.name}
                poster={details.poster ?? details.details_banner ?? null}
                totalEpisodes={details.seasons?.reduce((acc, s) => acc + (s.episodes?.length || 0), 0) || null}
              />
              <FavoriteButton
                id={details.ID}
                name={details.name}
                poster={details.poster ?? details.details_banner ?? null}
              />
              <AddToListButton
                animeId={details.ID}
                animeName={details.name}
                poster={details.poster ?? details.details_banner ?? null}
              />
            </div>
          </div>
        </div>

        {details.studios && details.studios.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Stüdyolar:</span>
            {details.studios.map((s) => (
              <span
                key={s.ID}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium"
              >
                {s.name}
              </span>
            ))}
          </div>
        )}

        <CastSection cast={tmdbCast ?? []} />

        {details.avatar && details.avatar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-bold tracking-tight md:text-2xl">Karakterler</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
              {details.avatar.map((char) => (
                <div
                  key={char.ID}
                  className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-[var(--card)] border border-[var(--border)]">
                    {char.link ? (
                      <AniziumImage src={char.link} alt={char.name} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted-foreground)]">?</div>
                    )}
                  </div>
                  <span className="text-[10px] font-medium leading-tight text-[var(--foreground)] line-clamp-2">{char.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Seasons */}
        {(details.seasons ?? []).length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">Bölümler</h2>
            <SeasonTabs
              animeId={details.ID}
              seasons={details.seasons ?? []}
              upcomingEpisode={toUpcomingEpisodePlaceholder(upcomingCalendarItem, details.seasons ?? [])}
            />

            {genreLinks.length > 0 && (
              <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">Benzer tatta ne izlenebilir?</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
                  Eğer {details.name} hoşuna gittiyse aşağıdaki tür sayfalarından benzer yapımları keşfedebilirsin.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {genreLinks.map((genre) => (
                    <Link
                      key={genre.ID}
                      href={getGenreHref(genre.name)}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      {genre.name} animeleri
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <RecommendedAnime
              items={similar?.page?.data ?? []}
              title="Bu animeyi izlediysen bunları da beğenebilirsin"
            />
          </section>
        )}

        {(details.seasons ?? []).length === 0 && (
          <>
            {genreLinks.length > 0 && (
              <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">Benzer tatta ne izlenebilir?</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
                  Eğer {details.name} hoşuna gittiyse aşağıdaki tür sayfalarından benzer yapımları keşfedebilirsin.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {genreLinks.map((genre) => (
                    <Link
                      key={genre.ID}
                      href={getGenreHref(genre.name)}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      {genre.name} animeleri
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <RecommendedAnime
              items={similar?.page?.data ?? []}
              title="Bu animeyi izlediysen bunları da beğenebilirsin"
            />
          </>
        )}

        <section className="mt-10 border-t border-[var(--border)] pt-8">
          <CommentThread animeId={details.ID} heading="Seri yorumları" />
        </section>
      </div>
    </div>
  );
}
