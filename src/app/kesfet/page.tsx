export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCatalog, type CatalogKind } from "@/lib/anizium/endpoints";
import { fetchPagedCatalog } from "@/lib/anizium/paginate";
import { AnimeGrid, AnimeGridSkeleton } from "@/components/anime/anime-grid";
import { Pagination } from "@/components/ui/pagination";
import { GENRES } from "@/lib/anizium/constants";
import { Suspense } from "react";
import { GenreDropdown } from "@/components/discovery/genre-dropdown";

export const revalidate = 1800;

const KIND_LABELS: Record<CatalogKind, string> = {
  series: "Seriler",
  movie: "Filmler",
  trdub: "Türkçe Dublaj",
  genre: "Tür",
};

type SP = { kind?: string; id?: string; page?: string; year?: string };

export default async function KesfetPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const kind = (["series", "movie", "trdub", "genre"] as const).includes(
    sp.kind as CatalogKind
  )
    ? (sp.kind as CatalogKind)
    : "series";
  const id = sp.id;
  const page = Number(sp.page ?? "1") || 1;

  const res = await fetchPagedCatalog(
    (p) => getCatalog({ kind, id, page: p }),
    page,
    24
  );

  const activeGenre = kind === "genre" ? GENRES.find((g) => g.id === id) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          {kind === "genre" && activeGenre
            ? `Tür: ${activeGenre.name}`
            : "Keşfet"}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Binlerce anime, film ve 4K içerik arasında gezin.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["series", "movie", "trdub"] as CatalogKind[]).map((k) => (
          <Link
            key={k}
            href={`/kesfet?kind=${k}`}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              kind === k && !id
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
            }`}
          >
            {KIND_LABELS[k]}
          </Link>
        ))}
        <div className="mx-2 h-6 w-px bg-[var(--border)]" />
        <GenreDropdown activeGenreId={id} />
      </div>

      <Suspense fallback={<AnimeGridSkeleton />}>
        <AnimeGrid items={res.page.data} />
      </Suspense>

      <Pagination
        basePath="/kesfet"
        page={page}
        totalPages={res.page.total_pages ?? 0}
        extraParams={{ kind, id }}
      />
    </div>
  );
}
