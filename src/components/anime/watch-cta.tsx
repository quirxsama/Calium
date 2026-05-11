"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useHistory } from "@/hooks/use-history";
import { isEpisodeFinished } from "@/lib/storage/history";

type Props = {
  animeId: string;
  firstEpisodeId?: string | null;
  isMovie?: boolean;
};

export function WatchCta({ animeId, firstEpisodeId, isMovie = false }: Props) {
  const historyEntry = useHistory().find((entry) => entry.animeId === animeId);
  const canWatch = Boolean(firstEpisodeId || isMovie);

  if (!canWatch) return null;

  const hasUnfinishedProgress = historyEntry
    ? !isEpisodeFinished(historyEntry.progress, historyEntry.duration)
    : false;
  const targetEpisodeId = hasUnfinishedProgress
    ? historyEntry?.episodeId
    : firstEpisodeId ?? "film";
  const label = hasUnfinishedProgress
    ? "Kaldığın Yerden Devam Et"
    : isMovie && !firstEpisodeId
      ? "Filmi İzle"
      : "İlk Bölümü İzle";

  return (
    <Link
      href={`/izle/${encodeURIComponent(animeId)}/${encodeURIComponent(targetEpisodeId ?? "film")}`}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg transition hover:brightness-110"
    >
      <Play className="h-4 w-4 fill-current" />
      {label}
    </Link>
  );
}
