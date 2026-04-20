export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimeDetails } from "@/lib/anizium/endpoints";
import { SeasonTabs } from "@/components/anime/season-tabs";
import { FavoriteButton } from "@/components/anime/favorite-button";
import { AddToListButton } from "@/components/anime/add-to-list-button";
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
  try {
    details = (await getAnimeDetails(id)).data;
  } catch {
    notFound();
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
            sizes="100vw"
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
            <div className="relative w-40 md:w-56 shrink-0 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-[var(--border)] bg-[var(--card)]">
              <Image src={details.poster} alt={details.name} fill sizes="240px" className="object-cover" />
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

        {/* Seasons */}
        {(details.seasons ?? []).length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">Bölümler</h2>
            <SeasonTabs animeId={details.ID} seasons={details.seasons ?? []} />
          </section>
        )}
      </div>
    </div>
  );
}
