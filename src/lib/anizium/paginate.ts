import type { ApiResponse } from "./schemas";

/**
 * Anizium API sayfa başına sabit sayıda (tipik ~20) öğe döndürür.
 * Site tarafında farklı bir sayfa boyutu (örn. 24) sunmak için,
 * hedef site sayfasına denk gelen API sayfalarını paralel çekip
 * dilimleyerek birleştirir.
 *
 * @param fetchApiPage  (apiPage) => Promise<ApiResponse>  — tek API sayfası getiren fonksiyon
 * @param sitePage      1-indexed site sayfası
 * @param perPage       site sayfa boyutu (varsayılan 24)
 * @returns             ApiResponse benzeri nesne; total_pages site bazında yeniden hesaplanır
 */
export async function fetchPagedCatalog(
  fetchApiPage: (apiPage: number) => Promise<ApiResponse>,
  sitePage: number,
  perPage = 24
): Promise<ApiResponse> {
  // İlk API sayfasını çek ki apiPerPage ve toplam sayfa sayısını öğrenelim.
  const first = await fetchApiPage(1);
  const apiPerPage = first.page.per_page_items && first.page.per_page_items > 0
    ? first.page.per_page_items
    : first.page.data.length || 20;
  const apiTotalPages = first.page.total_pages ?? 1;
  const totalItems = apiTotalPages * apiPerPage;
  const siteTotalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const safeSitePage = Math.min(Math.max(1, sitePage), siteTotalPages);
  const start = (safeSitePage - 1) * perPage;
  const end = start + perPage;

  const firstApiPage = Math.floor(start / apiPerPage) + 1;
  const lastApiPage = Math.min(
    apiTotalPages,
    Math.floor((end - 1) / apiPerPage) + 1
  );

  // İhtiyaç duyulan API sayfalarını paralel çek (zaten çektiğimiz 1. sayfayı tekrar kullan).
  const pageNumbers: number[] = [];
  for (let p = firstApiPage; p <= lastApiPage; p++) pageNumbers.push(p);

  const pages = await Promise.all(
    pageNumbers.map((p) => (p === 1 ? Promise.resolve(first) : fetchApiPage(p)))
  );

  const merged = pages.flatMap((r) => r.page.data);
  const offset = start - (firstApiPage - 1) * apiPerPage;
  const sliced = merged.slice(offset, offset + perPage);

  return {
    success: true,
    page: {
      page: safeSitePage,
      per_page_items: perPage,
      previous_page: safeSitePage > 1 ? safeSitePage - 1 : null,
      next_page: safeSitePage < siteTotalPages ? safeSitePage + 1 : null,
      total_pages: siteTotalPages,
      data: sliced,
    },
  };
}
