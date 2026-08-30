const ANIME_SKIP_URL = "https://api.anime-skip.com/graphql";
const ANIME_SKIP_CLIENT_ID = "ZGfO0sMF3eCwLYf8yMSCJjlynwNGRXWE";
const ANILIST_URL = "https://graphql.anilist.co";

export type RecapInterval = {
  recapStart: number;
  recapEnd: number;
};

type AnimeSkipTimestamp = {
  at: number;
  type: { name: string };
};

type AnimeSkipEpisode = {
  number: string | null;
  absoluteNumber: string | null;
  timestamps: AnimeSkipTimestamp[];
};

type AnimeSkipShow = {
  id: string;
  name: string;
  episodeCount: number;
  episodes: AnimeSkipEpisode[];
};

async function queryAnimeSkip<T>(query: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(ANIME_SKIP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-ID": ANIME_SKIP_CLIENT_ID,
    },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok) throw new Error(`anime-skip ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

async function getAniListId(animeName: string, signal?: AbortSignal): Promise<number | null> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ($search: String) {
        Media(search: $search, type: ANIME) { id }
      }`,
      variables: { search: animeName },
    }),
    signal,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.Media?.id ?? null;
}

function extractRecapInterval(timestamps: AnimeSkipTimestamp[]): RecapInterval | null {
  if (timestamps.length === 0) return null;

  const sorted = [...timestamps].sort((a, b) => a.at - b.at);
  const firstRecapIdx = sorted.findIndex((t) => t.type.name === "Recap");
  if (firstRecapIdx < 0) return null;

  let lastRecapIdx = firstRecapIdx;
  for (let i = firstRecapIdx + 1; i < sorted.length; i++) {
    if (sorted[i].type.name === "Recap") lastRecapIdx = i;
    else break;
  }

  const recapStart = sorted[firstRecapIdx].at;
  const nextAfterRecap = sorted[lastRecapIdx + 1];
  if (!nextAfterRecap) return null;

  return { recapStart, recapEnd: nextAfterRecap.at };
}

const cache = new Map<string, { data: RecapInterval | null; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30;

export async function getRecapForEpisode(
  animeName: string,
  episodeNumber: number,
  signal?: AbortSignal
): Promise<RecapInterval | null> {
  const cacheKey = `${animeName}::${episodeNumber}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const anilistId = await getAniListId(animeName, signal);
    if (!anilistId) return null;

    const data = await queryAnimeSkip<{ findShowsByExternalId: AnimeSkipShow[] }>(
      `{ findShowsByExternalId(service: ANILIST, serviceId: "${anilistId}") {
        id name episodeCount
        episodes { number absoluteNumber timestamps { at type { name } } }
      } }`,
      signal
    );

    const shows = data.findShowsByExternalId;
    if (!shows?.length) return null;

    const show = shows.reduce((best, s) => (s.episodeCount > best.episodeCount ? s : best), shows[0]);

    const epStr = String(episodeNumber);
    const episode = show.episodes.find(
      (ep) => ep.number === epStr || ep.absoluteNumber === epStr
    );
    if (!episode) {
      cache.set(cacheKey, { data: null, ts: Date.now() });
      return null;
    }

    const result = extractRecapInterval(episode.timestamps);
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    console.warn("[anime-skip] recap fetch failed:", e);
    return null;
  }
}
