import type { CalendarContent, EpisodeData, Season } from "./schemas";

export const CALENDAR_TIME_ZONE = "Europe/Istanbul";

export type UpcomingCalendarEntry = {
  item: CalendarContent;
  date: Date;
};

export type UpcomingEpisodePlaceholder = {
  id: string;
  season: string | number | null;
  number: string | number | null;
  releaseText: string;
  image: string | null;
};

type EpisodeSource = Pick<EpisodeData, "number">;
type SeasonSource = Pick<Season, "number" | "episodes">;

export function toCalendarDate(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
}

export function startOfTodayInIstanbul() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return new Date(`${parts}T00:00:00+03:00`);
}

export function getCalendarDayDiff(date: Date) {
  const today = startOfTodayInIstanbul();
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: CALENDAR_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatCalendarDateWithWeekday(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: CALENDAR_TIME_ZONE,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
}

export function formatRelativeCalendarDate(date: Date, casing: "lower" | "title" = "lower") {
  const diff = getCalendarDayDiff(date);
  const value = (() => {
    if (diff === 0) return "bugün";
    if (diff === 1) return "yarın";
    if (diff > 1) return `${diff} gün sonra`;
    if (diff === -1) return "dün";
    return `${Math.abs(diff)} gün önce`;
  })();

  if (casing === "title") return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
  return value;
}

export function getCalendarEpisodeLabel(item: CalendarContent) {
  const parts = [];
  if (item.season) parts.push(`${item.season}. sezon`);
  if (item.episode) parts.push(`${item.episode}. bölüm`);
  return parts.length > 0 ? parts.join(" · ") : "sonraki bölüm";
}

export function isCalendarEpisode(item: CalendarContent) {
  return item.on_air || item.category.includes("seasonal_anime") || Boolean(item.episode);
}

function numericValue(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasEpisodeInSeasons(
  item: CalendarContent,
  seasons: SeasonSource[] = []
) {
  const episodeNumber = numericValue(inferUpcomingEpisodeNumber(item, seasons));
  if (episodeNumber == null) return false;

  const calendarSeason = numericValue(item.season);
  const matchingSeasons = calendarSeason == null
    ? seasons
    : seasons.filter((season) => numericValue(season.number) === calendarSeason);

  return matchingSeasons.some((season) =>
    (season.episodes ?? []).some((episode) => numericValue(episode.number) === episodeNumber)
  );
}

export function inferUpcomingEpisodeNumber(
  item: CalendarContent,
  seasons: SeasonSource[] = []
): string | number | null {
  if (item.episode) return item.episode;

  const calendarSeason = numericValue(item.season);
  const matchingSeason = calendarSeason == null
    ? seasons[seasons.length - 1]
    : seasons.find((season) => numericValue(season.number) === calendarSeason);
  const episodes: EpisodeSource[] = matchingSeason?.episodes ?? [];
  const lastNumber = episodes.reduce<number | null>((max, episode) => {
    const n = numericValue(episode.number);
    if (n == null) return max;
    return max == null || n > max ? n : max;
  }, null);

  return lastNumber == null ? null : lastNumber + 1;
}

export function getUpcomingCalendarItem(
  items: CalendarContent[],
  animeId: string,
  seasons: SeasonSource[] = []
) {
  const today = startOfTodayInIstanbul().getTime();
  return items
    .filter((item) => {
      const calendarAnimeId = item.content_id ?? item.ID;
      return (
        item.active &&
        isCalendarEpisode(item) &&
        calendarAnimeId === animeId &&
        !hasEpisodeInSeasons(item, seasons)
      );
    })
    .map((item) => ({ item, date: toCalendarDate(item.release_date) }))
    .filter((entry): entry is UpcomingCalendarEntry => {
      return Boolean(entry.date && entry.date.getTime() >= today);
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
}

export function toUpcomingEpisodePlaceholder(
  entry: UpcomingCalendarEntry | null,
  seasons: SeasonSource[] = []
): UpcomingEpisodePlaceholder | null {
  if (!entry) return null;
  const { item, date } = entry;
  return {
    id: item._id ?? `upcoming-${item.ID}-${item.season ?? "s"}-${item.episode ?? "e"}`,
    season: item.season ?? null,
    number: inferUpcomingEpisodeNumber(item, seasons),
    releaseText: `${formatCalendarDate(date)} tarihinde (${formatRelativeCalendarDate(date)}) yayınlanacak`,
    image: item.content.banner ?? item.content.details_banner ?? item.content.poster ?? null,
  };
}
