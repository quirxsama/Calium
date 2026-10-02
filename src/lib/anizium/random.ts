type CatalogPage = {
  success: boolean;
  page: {
    page: number;
    per_page_items: number;
    total_pages: number;
    data: { ID: string }[];
  };
};

type LoadCatalog = (kind: "series", page: number) => Promise<CatalogPage>;

export class CatalogRequestError extends Error {
  constructor(page: number, status?: number) {
    super(`Dizi kataloğu yüklenemedi (sayfa ${page}${status ? `, HTTP ${status}` : ""}).`);
  }
}

export async function selectRandomAnime(load: LoadCatalog, random = Math.random): Promise<string> {
  async function loadPage(page: number) {
    try {
      return await load("series", page);
    } catch (error) {
      throw error instanceof CatalogRequestError ? error : new CatalogRequestError(page);
    }
  }

  const first = await loadPage(1);
  const pages = first?.page?.total_pages;
  const size = first?.page?.per_page_items;
  if (!Number.isSafeInteger(pages) || pages < 0 || !Number.isSafeInteger(size) || size < 0) {
    throw new Error("Geçersiz katalog bilgisi (dizi, sayfa 1).");
  }

  function validate(response: CatalogPage, page: number) {
    const data = response?.page;
    if (!response?.success || !data || data.page !== page || data.total_pages !== pages ||
        data.per_page_items !== size || !Array.isArray(data.data) ||
        data.data.some((item) => !item || typeof item.ID !== "string" || !item.ID.trim()) ||
        (pages === 0 ? data.data.length !== 0 :
          size === 0 || data.data.length > size ||
          (page < pages ? data.data.length !== size : data.data.length === 0))) {
      throw new Error(`Dizi kataloğu eksik veya değişmiş (sayfa ${page}).`);
    }
    return data.data;
  }

  const firstItems = validate(first, 1);
  const lastItems = pages > 1 ? validate(await loadPage(pages), pages) : firstItems;
  const count = pages === 0 ? 0 : (pages - 1) * size + lastItems.length;
  if (!Number.isSafeInteger(count)) throw new Error("Geçersiz katalog boyutu");
  if (count === 0) throw new Error("Katalogda anime dizisi bulunamadı");
  const draw = random();
  if (!(draw >= 0 && draw < 1)) throw new Error("Geçersiz rastgele seçim");
  const index = Math.floor(draw * count);
  const page = Math.floor(index / size) + 1;
  const items = page === 1 ? firstItems : page === pages ? lastItems :
    validate(await loadPage(page), page);
  return items[index % size].ID;
}
