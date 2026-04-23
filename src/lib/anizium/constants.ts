export const WORKER_URL =
  process.env.ANIZIUM_WORKER_URL || "";

export const PROXY_KEY =
  process.env.ANIZIUM_PROXY_KEY || "";

export const DOMAIN_LIST_URL =
  "https://raw.githubusercontent.com/Kraptor123/domainListesi/refs/heads/main/eklenti_domainleri.txt";

export const FALLBACK_DOMAIN =
  process.env.ANIZIUM_FALLBACK_DOMAIN || "https://api.anizium.co";

// NOT: CF_CONTROL ve USER_SESSION Anizium upstream'inde kimlik doğrulama
// için kullanılır. Gizli tutulmalı — default değerleri repo'da bulundurma.
// `.env.local`'de set edilmemişse ilk istekte explicit hata fırlatılır.
export const CF_CONTROL = process.env.ANIZIUM_CF_CONTROL || "";

export const USER_SESSION = process.env.ANIZIUM_USER_SESSION || "";

export const USER_AGENT =
  process.env.ANIZIUM_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

export const ORIGIN = "https://x.anizium.co";

export const GENRES: { id: string; name: string; slug: string }[] = [
  { id: "54464", name: "Aile ve Çocuk", slug: "aile-ve-cocuk" },
  { id: "62263", name: "Aksiyon", slug: "aksiyon" },
  { id: "40034", name: "Askeri", slug: "askeri" },
  { id: "90158", name: "Bilim Kurgu", slug: "bilim-kurgu" },
  { id: "82742", name: "Büyü ve Kılıç", slug: "buyu-ve-kilic" },
  { id: "11860", name: "Doğaüstü", slug: "dogaustu" },
  { id: "57282", name: "Dram", slug: "dram" },
  { id: "88689", name: "Dövüş Sanatları", slug: "dovus-sanatlari" },
  { id: "17263", name: "Ecchi", slug: "ecchi" },
  { id: "43261", name: "Fantastik", slug: "fantastik" },
  { id: "14837", name: "Gençlik Hikayesi", slug: "genclik-hikayesi" },
  { id: "57593", name: "Gerilim", slug: "gerilim" },
  { id: "78746", name: "Gizem", slug: "gizem" },
  { id: "73510", name: "Harem", slug: "harem" },
  { id: "33458", name: "Hayatta Kalma", slug: "hayatta-kalma" },
  { id: "23813", name: "Isekai", slug: "isekai" },
  { id: "34953", name: "Iyashikei", slug: "iyashikei" },
  { id: "79741", name: "İngilizce Dublaj", slug: "ingilizce-dublaj" },
  { id: "40838", name: "Kara Mizah", slug: "kara-mizah" },
  { id: "92619", name: "Karanlık Fantastik", slug: "karanlik-fantastik" },
  { id: "59624", name: "Romantizm", slug: "romantizm" },
  { id: "47450", name: "Komedi", slug: "komedi" },
  { id: "7628", name: "Korku", slug: "korku" },
  { id: "5263", name: "Macera", slug: "macera" },
  { id: "21846", name: "Meka", slug: "meka" },
  { id: "43306", name: "Mitoloji", slug: "mitoloji" },
  { id: "73505", name: "Okul", slug: "okul" },
  { id: "50737", name: "Parodi", slug: "parodi" },
  { id: "29049", name: "Psikolojik", slug: "psikolojik" },
  { id: "38932", name: "Reenkarnasyon", slug: "reenkarnasyon" },
  { id: "63917", name: "Samuray", slug: "samuray" },
  { id: "75150", name: "Sanat", slug: "sanat" },
  { id: "87910", name: "Seinen", slug: "seinen" },
  { id: "94032", name: "Shounen", slug: "shounen" },
  { id: "25731", name: "Spor", slug: "spor" },
  { id: "8159", name: "Tarih", slug: "tarih" },
  {
    id: "263101",
    name: "Tatlı Kızlar Tatlı Şeyler Yaparlar",
    slug: "tatli-kizlar-tatli-seyler-yaparlar",
  },
  { id: "66407", name: "Türkçe Dublaj", slug: "turkce-dublaj" },
  { id: "79793", name: "Vahşet", slug: "vahset" },
  { id: "38454", name: "Vampir", slug: "vampir" },
  { id: "47202", name: "Yaşamdan Kesitler", slug: "yasamdan-kesitler" },
  { id: "15055", name: "Çoklu Alt Yazı", slug: "coklu-alt-yazi" },
  { id: "84484", name: "Ödüllü Animeler", slug: "odullu-animeler" },
  { id: "21923", name: "Şehir Macerası", slug: "sehir-macerasi" },
];

export const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

// Cache süreleri (saniye)
export const CACHE_TTL = {
  domain: 300, // 5dk
  latest: 600, // 10dk
  catalog: 1800, // 30dk
  top: 1800,
  detail: 3600, // 1sa
  search: 300,
  tmdb: 7200, // 2sa
};
