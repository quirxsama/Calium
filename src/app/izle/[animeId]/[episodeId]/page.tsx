export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getAnimeDetails } from "@/lib/anizium/endpoints";
import { WatchPageClient } from "@/components/player/watch-page-client";

export const revalidate = 3600;

export default async function IzlePage({
  params,
}: {
  params: Promise<{ animeId: string; episodeId: string }>;
}) {
  const { animeId, episodeId } = await params;
  let details;
  try {
    details = (await getAnimeDetails(animeId)).data;
  } catch {
    notFound();
  }
  return <WatchPageClient details={details} episodeId={episodeId} />;
}
