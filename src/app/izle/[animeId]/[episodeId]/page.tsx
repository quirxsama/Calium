export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getAnimeDetails, getCalendar } from "@/lib/anizium/endpoints";
import { getUpcomingCalendarItem, toUpcomingEpisodePlaceholder } from "@/lib/anizium/calendar";
import { WatchPageClient } from "@/components/player/watch-page-client";

export const revalidate = 3600;

export default async function IzlePage({
  params,
}: {
  params: Promise<{ animeId: string; episodeId: string }>;
}) {
  const { animeId, episodeId } = await params;
  let details;
  let calendar;
  try {
    const [detailsRes, calendarRes] = await Promise.all([
      getAnimeDetails(animeId),
      getCalendar().catch(() => null),
    ]);
    details = detailsRes.data;
    calendar = calendarRes;
  } catch {
    notFound();
  }
  const upcomingCalendarItem = getUpcomingCalendarItem(
    calendar?.data.flatMap((day) => day.contents) ?? [],
    details.ID
  );
  return (
    <WatchPageClient
      details={details}
      episodeId={episodeId}
      upcomingEpisode={toUpcomingEpisodePlaceholder(upcomingCalendarItem, details.seasons ?? [])}
    />
  );
}
