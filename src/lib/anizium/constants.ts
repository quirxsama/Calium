export const WORKER_URL =
  process.env.ANIZIUM_WORKER_URL || "";

export const PROXY_KEY =
  process.env.ANIZIUM_PROXY_KEY || "";

export const DOMAIN_LIST_URL =
  "https://raw.githubusercontent.com/Kraptor123/domainListesi/refs/heads/main/eklenti_domainleri.txt";

export const FALLBACK_DOMAIN =
  process.env.ANIZIUM_FALLBACK_DOMAIN || "https://api.anizium.co";

export const CF_CONTROL =
  process.env.ANIZIUM_CF_CONTROL ||
  "134e4c040840015655080906544d030f004b4c075b54500f";

export const USER_SESSION =
  process.env.ANIZIUM_USER_SESSION ||
  "01570d01545f55510102040f525d390e00094f0556514e2d1d5201580100071e030350115a53534c05550f535143455c085c54101215";

export const USER_AGENT =
  process.env.ANIZIUM_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

export const ORIGIN = "https://x.anizium.co";

export const GENRES: { id: string; name: string; slug: string }[] = [
  { id: "62263", name: "Aksiyon", slug: "aksiyon" },
  { id: "43261", name: "Fantastik", slug: "fantastik" },
  { id: "23813", name: "Isekai", slug: "isekai" },
  { id: "59624", name: "Romantizm", slug: "romantizm" },
  { id: "47450", name: "Komedi", slug: "komedi" },
  { id: "87910", name: "Seinen", slug: "seinen" },
  { id: "94032", name: "Shounen", slug: "shounen" },
];

// Cache süreleri (saniye)
export const CACHE_TTL = {
  domain: 300, // 5dk
  latest: 600, // 10dk
  catalog: 1800, // 30dk
  top: 1800,
  detail: 3600, // 1sa
  search: 300,
};
