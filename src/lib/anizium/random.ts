type CatalogPage = {
  success: boolean;
  page: {
    page: number;
    per_page_items: number;
    total_pages: number;
    data: { ID: string }[];
  };
};

type LoadCatalog = (kind: "series" | "movie", page: number) => Promise<CatalogPage>;

export async function selectRandomAnime(load: LoadCatalog, random = Math.random): Promise<string> {
  const catalogs = await Promise.all((["series", "movie"] as const).map(async (kind) => {
    const first = await load(kind, 1);
    const { total_pages: pages, per_page_items: size } = first.page;
    if (!Number.isSafeInteger(pages) || pages < 0 || !Number.isSafeInteger(size) || size < 0) {
      throw new Error("Geçersiz katalog bilgisi");
    }

    function validate(response: CatalogPage, page: number) {
      const data = response.page;
      if (!response.success || data.page !== page || data.total_pages !== pages ||
          data.per_page_items !== size || !Array.isArray(data.data) ||
          data.data.some((item) => typeof item.ID !== "string" || !item.ID.trim()) ||
          (pages === 0 ? data.data.length !== 0 :
            size === 0 || data.data.length > size ||
            (page < pages ? data.data.length !== size : data.data.length === 0))) {
        throw new Error("Katalog eksik veya değişmiş. Tekrar dene.");
      }
      return data.data;
    }

    const firstItems = validate(first, 1);
    const lastItems = pages > 1 ? validate(await load(kind, pages), pages) : firstItems;
    const count = pages === 0 ? 0 : (pages - 1) * size + lastItems.length;
    if (!Number.isSafeInteger(count)) throw new Error("Geçersiz katalog boyutu");
    return { kind, pages, size, count, firstItems, lastItems, validate };
  }));

  const total = catalogs.reduce((sum, catalog) => sum + catalog.count, 0);
  if (!Number.isSafeInteger(total) || total === 0) throw new Error("Katalogda anime bulunamadı");
  const draw = random();
  if (!(draw >= 0 && draw < 1)) throw new Error("Geçersiz rastgele seçim");
  let index = Math.floor(draw * total);
  for (const catalog of catalogs) {
    if (index >= catalog.count) {
      index -= catalog.count;
      continue;
    }
    const page = Math.floor(index / catalog.size) + 1;
    const items = page === 1 ? catalog.firstItems : page === catalog.pages ? catalog.lastItems :
      catalog.validate(await load(catalog.kind, page), page);
    return items[index % catalog.size].ID;
  }
  throw new Error("Anime seçilemedi");
}
