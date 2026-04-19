"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeCard } from "./anime-card";
import type { AnimeData } from "@/lib/anizium/schemas";
import Link from "next/link";

type Props = {
  title: string;
  items: AnimeData[];
  href?: string;
};

export function AnimeRail({ title, items, href }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items || items.length === 0) return null;

  function scroll(dir: 1 | -1) {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="group/rail mb-12 md:mb-14">
      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <h2 className="section-title text-lg md:text-2xl font-bold tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {href && (
            <Link
              href={href}
              className="group/link inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              Tümünü Gör
              <span className="transition-transform duration-300 group-hover/link:translate-x-0.5">→</span>
            </Link>
          )}
          <div className="hidden md:flex items-center gap-1.5">
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
      </div>
      <div
        ref={ref}
        className="no-scrollbar flex gap-3 md:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 -mx-1 px-1"
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
