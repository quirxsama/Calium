export const dynamic = "force-dynamic";
import { getCatalog } from "@/lib/anizium/endpoints";
import { fetchPagedCatalog } from "@/lib/anizium/paginate";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { Pagination } from "@/components/ui/pagination";

export const revalidate = 1800;

export default async function DublajPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1") || 1;
  const res = await fetchPagedCatalog(
    (p) => getCatalog({ kind: "trdub", page: p }),
    page,
    24
  );
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Türkçe Dublaj</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Türkçe dublajlı animeler.
        </p>
      </header>
      <AnimeGrid items={res.page.data} />
      <Pagination basePath="/dublaj" page={page} totalPages={res.page.total_pages ?? 0} />
    </div>
  );
}
