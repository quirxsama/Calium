export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/anizium/endpoints";
import { fetchPagedCatalog } from "@/lib/anizium/paginate";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { Pagination } from "@/components/ui/pagination";
import { GENRES } from "@/lib/anizium/constants";
import { absoluteUrl, buildBreadcrumbJsonLd, SITE_NAME } from "@/lib/seo";

export const revalidate = 1800;

function buildGenreDescription(genreName: string, page: number) {
  const pageText = page > 1 ? ` ${page}. sayfa sonuçlarıyla` : "";
  return `${genreName} anime önerileri, öne çıkan seriler ve izleme listeleri${pageText} ${SITE_NAME} üzerinde seni bekliyor.`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr ?? "1") || 1);
  const genre = GENRES.find((item) => item.slug === slug);

  if (!genre) {
    return {
      title: `Tür bulunamadı | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const title = `${genre.name} anime önerileri | ${SITE_NAME}`;
  const description = buildGenreDescription(genre.name, page);
  const canonical = page > 1 ? `/tur/${genre.slug}?page=${page}` : `/tur/${genre.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    keywords: [genre.name, `${genre.name} anime`, `${genre.name} anime önerileri`, `${genre.name} izle`],
  };
}

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

  const pageTitle = `${genre.name} anime önerileri`;
  const intro = buildGenreDescription(genre.name, page);
  const canonicalPath = page > 1 ? `/tur/${genre.slug}?page=${page}` : `/tur/${genre.slug}`;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Ana Sayfa", path: "/" },
    { name: "Türler", path: "/kesfet" },
    { name: genre.name, path: canonicalPath },
  ]);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: intro,
    url: absoluteUrl(canonicalPath),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: res.page.data.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/anime/${encodeURIComponent(item.ID)}`),
        name: item.name,
      })),
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          {genre.name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
          {intro}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
          <Link href="/kesfet" className="underline underline-offset-4">Keşfet sayfasına dön</Link>
          <Link href="/top" className="underline underline-offset-4">Popüler anime listesine git</Link>
          {page > 1 && <span>{page}. sayfadasın</span>}
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">{genre.name} türünde ne bulacaksın?</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
          Bu sayfa, {genre.name.toLocaleLowerCase("tr-TR")} temasına ilgi duyan izleyiciler için hazırlanmış bir keşif alanıdır. Öne çıkan yapımları tek yerde inceleyebilir, seni benzer türlerdeki anime detay sayfalarına götüren iç linklerle yeni seriler keşfedebilirsin.
        </p>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
          Özellikle {genre.name.toLocaleLowerCase("tr-TR")} arayan kullanıcılar için bu sayfa; hızlı seçim yapmayı kolaylaştıran liste görünümü, dahili bağlantılar ve düzenli güncellenen katalog akışıyla SEO açısından güçlü bir landing page olarak çalışır.
        </p>
      </section>

      <AnimeGrid items={res.page.data} />
      <Pagination
        basePath={`/tur/${slug}`}
        page={page}
        totalPages={res.page.total_pages ?? 0}
      />
    </div>
  );
}
