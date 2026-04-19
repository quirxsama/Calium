"use client";
import { useState } from "react";
import type { Season } from "@/lib/anizium/schemas";
import { EpisodeList } from "./episode-list";

export function SeasonTabs({
  animeId,
  seasons,
}: {
  animeId: string;
  seasons: Season[];
}) {
  const [active, setActive] = useState(seasons[0]?.ID);
  if (!seasons.length) {
    return (
      <p className="text-[var(--muted-foreground)]">Bölüm bilgisi bulunamadı.</p>
    );
  }
  const season = seasons.find((s) => s.ID === active) ?? seasons[0];

  return (
    <div>
      {seasons.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {seasons.map((s) => (
            <button
              key={s.ID}
              onClick={() => setActive(s.ID)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                s.ID === season.ID
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <EpisodeList
        animeId={animeId}
        episodes={season.episodes}
        variant="grid"
      />
    </div>
  );
}
