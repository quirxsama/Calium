export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/anizium/endpoints";
import { fetchPagedCatalog } from "@/lib/anizium/paginate";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { Pagination } from "@/components/ui/pagination";
import { GENRES } from "@/lib/anizium/constants";

export const revalidate = 1800;

export default async function TurPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1") || 1;
  const genre = GENRES.find((g) => g.slug === slug);
  if (!genre) notFound();

  let res;
  try {
    res = await fetchPagedCatalog(
      (p) => getCatalog({ kind: "genre", id: genre.id, page: p }),
      page,
      24
    );
  } catch {
    res = { success: false, page: { data: [], total_pages: 0, page } };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          {genre.name}
        </h1>
      </header>
      <AnimeGrid items={res.page.data} />
      <Pagination
        basePath={`/tur/${slug}`}
        page={page}
        totalPages={res.page.total_pages ?? 0}
      />
    </div>
  );
}
