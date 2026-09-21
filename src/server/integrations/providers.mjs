import { configuration, normalizeEntry } from "./core.mjs";

export class ProviderError extends Error {
  constructor(code, retryAfter = 60) {
    super(code);
    this.retryAfter = retryAfter;
  }
}
async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000), redirect: "error" });
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    const reset = Number(response.headers.get("x-ratelimit-reset")) - Date.now() / 1000;
    throw new ProviderError("rate_limited", Math.max(60, seconds || 0, reset || 0));
  }
  if (response.status === 401 || response.status === 403) throw new ProviderError("reauth_required");
  if (!response.ok) throw new ProviderError(response.status >= 500 ? "provider_unavailable" : "provider_rejected");
  const body = await response.json();
  if (body.errors?.length) throw new ProviderError(body.errors.some((e) => e.status === 429) ? "rate_limited" : "provider_rejected");
  return body;
}
export async function tokens(provider, values) {
  const config = configuration(provider);
  if (!config.configured) throw new ProviderError("integration_not_configured");
  const body = new URLSearchParams({ client_id: config.id, client_secret: config.secret, ...values });
  const result = await request(provider === "mal" ? "https://myanimelist.net/v1/oauth2/token" : "https://anilist.co/api/v2/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body,
  });
  if (typeof result.access_token !== "string" || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw new ProviderError("invalid_token_response");
  return result;
}
export async function graphql(token, query, variables = {}) {
  return (await request("https://graphql.anilist.co", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  })).data;
}
export async function identity(provider, token) {
  const user = provider === "mal"
    ? await request("https://api.myanimelist.net/v2/users/@me", { headers: { Authorization: `Bearer ${token}` } })
    : (await graphql(token, "query { Viewer { id name } }")).Viewer;
  if (!Number.isSafeInteger(user?.id) || typeof user.name !== "string") throw new ProviderError("invalid_identity");
  return { id: String(user.id), username: user.name };
}
const statuses = { CURRENT: "watching", COMPLETED: "completed", PAUSED: "on_hold", DROPPED: "dropped", PLANNING: "plan_to_watch", REPEATING: "watching" };
const toStatus = { watching: "CURRENT", completed: "COMPLETED", on_hold: "PAUSED", dropped: "DROPPED", plan_to_watch: "PLANNING" };
function date(value) {
  if (!value?.year) return null;
  return [String(value.year).padStart(4, "0"), ...(value.month ? [String(value.month).padStart(2, "0")] : []), ...(value.month && value.day ? [String(value.day).padStart(2, "0")] : [])].join("-");
}
function fuzzy(value) {
  if (!value) return { year: null, month: null, day: null };
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month ?? null, day: day ?? null };
}
export async function readList(provider, token, userId, pace = async () => {}) {
  const entries = [];
  if (provider === "mal") {
    for (let offset = 0; ; offset += 1000) {
      await pace();
      const result = await request(`https://api.myanimelist.net/v2/users/@me/animelist?limit=1000&offset=${offset}&nsfw=true&fields=num_episodes,main_picture,list_status{status,score,num_episodes_watched,is_rewatching,num_times_rewatched,start_date,finish_date}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!Array.isArray(result.data)) throw new ProviderError("invalid_list");
      for (const item of result.data) {
        const s = item.list_status;
        if (!s || !Number.isSafeInteger(item.node?.id)) throw new ProviderError("invalid_list");
        const poster = item.node?.main_picture?.large || item.node?.main_picture?.medium || null;
        entries.push({ malId: item.node.id, anilistId: null, title: item.node.title, totalEpisodes: item.node.num_episodes || null, remoteId: item.node.id, poster, value: normalizeEntry({ status: s.status, score: s.score * 10, progress: s.num_episodes_watched, repeat: s.num_times_rewatched, rewatching: s.is_rewatching, startedAt: s.start_date || null, completedAt: s.finish_date || null, poster }) });
      }
      if (!result.paging?.next) break;
      if (!result.data.length || offset > 100000) throw new ProviderError("invalid_pagination");
    }
  } else {
    for (let page = 1; ; page++) {
      await pace();
      const result = await graphql(token, "query($userId:Int!,$page:Int!){ Page(page:$page,perPage:50){pageInfo{hasNextPage} mediaList(userId:$userId,type:ANIME){id status progress score(format:POINT_100) repeat startedAt{year month day} completedAt{year month day} media{id idMal episodes title{romaji english userPreferred} coverImage{large medium}}}}}", { userId: Number(userId), page });
      if (!Array.isArray(result.Page?.mediaList)) throw new ProviderError("invalid_list");
      for (const item of result.Page.mediaList) {
        if (!statuses[item.status] || !Number.isSafeInteger(item.media?.id)) throw new ProviderError("invalid_list");
        const poster = item.media?.coverImage?.large || item.media?.coverImage?.medium || null;
        const title = item.media.title?.userPreferred || item.media.title?.romaji || item.media.title?.english;
        entries.push({ malId: item.media.idMal, anilistId: item.media.id, title, totalEpisodes: item.media.episodes, remoteId: item.id, poster, value: normalizeEntry({ status: statuses[item.status], progress: item.progress, score: item.score, repeat: item.repeat, rewatching: item.status === "REPEATING", startedAt: date(item.startedAt), completedAt: date(item.completedAt), poster }) });
      }
      if (!result.Page.pageInfo.hasNextPage) break;
      if (page > 2000) throw new ProviderError("invalid_pagination");
    }
  }
  return entries;
}
export async function writeEntry(provider, token, entry, value) {
  if (provider === "mal") {
    if (value.startedAt || value.completedAt) throw new ProviderError("mal_dates_write_unsupported");
    const body = new URLSearchParams({ status: value.status, score: String(Math.round(value.score / 10)), num_watched_episodes: String(value.progress), num_times_rewatched: String(value.repeat), is_rewatching: String(value.rewatching) });
    const result = await request(`https://api.myanimelist.net/v2/anime/${entry.malId}/my_list_status`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    return normalizeEntry({ ...value, score: result.score * 10, status: result.status, progress: result.num_episodes_watched, repeat: result.num_times_rewatched ?? value.repeat, rewatching: result.is_rewatching });
  }
  await graphql(token, "mutation($mediaId:Int!,$status:MediaListStatus!,$progress:Int!,$score:Float!,$repeat:Int!,$startedAt:FuzzyDateInput,$completedAt:FuzzyDateInput){SaveMediaListEntry(mediaId:$mediaId,status:$status,progress:$progress,score:$score,repeat:$repeat,startedAt:$startedAt,completedAt:$completedAt){id}}", { mediaId: entry.anilistId, status: value.rewatching ? "REPEATING" : toStatus[value.status], progress: value.progress, score: value.score / 10, repeat: value.repeat, startedAt: fuzzy(value.startedAt), completedAt: fuzzy(value.completedAt) });
  return value;
}
export async function bridge(token, malId) {
  const data = await graphql(token, "query($id:Int!){Media(idMal:$id,type:ANIME){id idMal episodes title{romaji}}}", { id: malId });
  return data?.Media;
}
export async function searchProvider(provider, token, title) {
  try {
    if (provider === "anilist") {
      const data = await graphql(token, "query($search:String){Media(search:$search,type:ANIME){id idMal episodes}}", { search: title });
      return data?.Media ? { anilistId: data.Media.id, malId: data.Media.idMal, totalEpisodes: data.Media.episodes } : null;
    }
    if (provider === "mal") {
      const res = await request(`https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(title)}&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
      const item = res?.data?.[0]?.node;
      return item ? { malId: item.id, anilistId: null, totalEpisodes: item.num_episodes || null } : null;
    }
  } catch {}
  return null;
}
