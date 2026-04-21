"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeCard } from "./anime-card";
import type { AnimeData } from "@/lib/anizium/schemas";

type Props = {
  items: AnimeData[];
  title?: string;
};

export function RecommendedAnime({ items, title = "Benzer Animeler" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items || items.length === 0) return null;

  function scroll(dir: 1 | -1) {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <h2 className="text-lg font-bold tracking-tight md:text-2xl">{title}</h2>
        <div className="hidden items-center gap-1.5 md:flex">
          <button
            aria-label="Sola kaydır"
            onClick={() => scroll(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]/60 backdrop-blur transition hover:scale-105 hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Sağa kaydır"
            onClick={() => scroll(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]/60 backdrop-blur transition hover:scale-105 hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 -mx-1 px-1 md:gap-4"
      >
        {items.map((a) => (
          <div
            key={a.ID}
            className="snap-start shrink-0 flex w-[44vw] sm:w-[30vw] md:w-[22vw] lg:w-[17vw] xl:w-[14vw] max-w-[200px]"
          >
            <AnimeCard
              id={a.ID}
              name={a.name}
              poster={a.poster}
              imdb={a.imdb_point}
              type={a.type}
              className="flex w-full flex-col"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
