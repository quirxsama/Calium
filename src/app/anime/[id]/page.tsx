export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimeDetails, getSimilarAnimes, getTMDBCredits } from "@/lib/anizium/endpoints";
import { SeasonTabs } from "@/components/anime/season-tabs";
import { FavoriteButton } from "@/components/anime/favorite-button";
import { AddToListButton } from "@/components/anime/add-to-list-button";
import { AnimePosterFlip } from "@/components/anime/anime-poster-flip";
import { CastSection } from "@/components/anime/cast-section";
import { RecommendedAnime } from "@/components/anime/recommended-anime";
import { Play, Star, Calendar } from "lucide-react";
import { formatAnimeType } from "@/lib/utils";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await getAnimeDetails(id);
    return {
      title: `${res.data.name} — Calium`,
      description: res.data.overview ?? undefined,
    };
  } catch {
    return { title: "Anime — Calium" };
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
  try {
    const [detailsRes, similarRes] = await Promise.all([
      getAnimeDetails(id),
      getSimilarAnimes(id).catch(() => null),
    ]);
    details = detailsRes.data;
    similar = similarRes;
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
  const isMovie = details.type && ["movie", "film"].includes(details.type.toLowerCase().trim());
  const rating = details.imdb_point ? Number(details.imdb_point) : null;

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[55vh] min-h-[360px] w-full overflow-hidden">
        {details.details_banner ? (
          <Image
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
                  <Image src={details.poster} alt={details.name} fill sizes="240px" className="object-cover" />
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
              <p className="mt-4 text-sm md:text-base text-[var(--muted-foreground)] max-w-3xl leading-relaxed">
                {details.overview}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {(firstEp || isMovie) && (
                <Link
                  href={`/izle/${encodeURIComponent(details.ID)}/${firstEp ? encodeURIComponent(firstEp.ID) : "film"}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg hover:brightness-110 transition"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isMovie && !firstEp ? "Filmi İzle" : "İlk Bölümü İzle"}
                </Link>
              )}
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
                      <Image src={char.link} alt={char.name} fill sizes="64px" className="object-cover" />
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
            <SeasonTabs animeId={details.ID} seasons={details.seasons ?? []} />
          </section>
        )}

        <RecommendedAnime items={similar?.page?.data ?? []} />
      </div>
    </div>
  );
}
