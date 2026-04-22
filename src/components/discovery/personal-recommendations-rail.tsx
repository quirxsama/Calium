"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnimeData } from "@/lib/anizium/schemas";
import { useHistory } from "@/hooks/use-history";
import { AnimeRail } from "@/components/anime/rail";

type RecommendationResponse = {
  success?: boolean;
  page?: { data?: AnimeData[] };
};

export function PersonalRecommendationsRail() {
  const history = useHistory();
  const [items, setItems] = useState<AnimeData[]>([]);

  const seed = useMemo(() => {
    const candidates = [...history]
      .sort((a, b) => {
        const aScore = (a.progress || 0) + (a.duration || 0) * 0.2;
        const bScore = (b.progress || 0) + (b.duration || 0) * 0.2;
        return bScore - aScore;
      })
      .slice(0, 5);

    if (candidates.length === 0) return null;
    const dayIndex = new Date().getDate() % candidates.length;
    const picked = candidates[dayIndex];
    return { id: picked.animeId, name: picked.animeName };
  }, [history]);

  useEffect(() => {
    if (!seed) return;

    const ctrl = new AbortController();
    fetch(`/api/anizium/anime/${encodeURIComponent(seed.id)}/similar`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: RecommendationResponse) => {
        if (!data?.success) {
          setItems([]);
          return;
        }
        const next = (data.page?.data ?? [])
          .filter((anime) => anime.ID !== seed.id)
          .slice(0, 18);
        setItems(next);
      })
      .catch(() => setItems([]));

    return () => ctrl.abort();
  }, [seed]);

  if (!seed || items.length === 0) return null;

  return (
    <AnimeRail
      title={`${seed.name} izlediysen bunları da beğenebilirsin`}
      items={items}
      href={`/anime/${encodeURIComponent(seed.id)}`}
    />
  );
}
