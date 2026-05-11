"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimeCard } from "./anime-card";
import type { AnimeData } from "@/lib/anizium/schemas";

type Props = {
  title: string;
  items: AnimeData[];
  href?: string;
};

export function AnimeRail({ title, items, href }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;

  function scroll(dir: 1 | -1) {
    if (!ref.current) return;
    const el = ref.current;
    const firstCard = el.querySelector<HTMLElement>("[data-rail-card]");
    const step = firstCard ? firstCard.offsetWidth + 16 : el.clientWidth * 0.8;
    const target = Math.max(0, Math.min(el.scrollLeft + dir * step * 4, el.scrollWidth - el.clientWidth));
    el.scrollTo({ left: target, behavior: "smooth" });
  }

  function closeModal() {
    setOpen(false);
  }

  return (
    <>
      <section className="group/rail mb-12 min-w-0 md:mb-14">
        <div className="mb-4 flex items-end justify-between gap-3 px-1">
          <h2 className="section-title text-lg md:text-2xl font-bold tracking-tight">
            {title}
          </h2>
          <div className="flex items-center gap-3">
            {href && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="group/link inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
              >
                Tümünü Gör
                <span className="transition-transform duration-300 group-hover/link:translate-x-0.5">→</span>
              </button>
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
          className="no-scrollbar flex min-w-0 gap-3 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory pb-3 -mx-1 px-1 md:gap-4"
        >
          {items.map((a) => (
            <div
              key={a.ID}
              data-rail-card
              className="snap-start shrink-0 flex w-[44vw] max-w-[200px] sm:w-[30vw] md:w-[22vw] lg:w-[17vw] xl:w-[14vw]"
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

      {open && <RailModal title={title} items={items} onClose={closeModal} />}
    </>
  );
}

function RailModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: AnimeData[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rail-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--background)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              Tümünü Gör
            </p>
            <h2 id="rail-modal-title" className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)]"
            aria-label="Modalı kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((anime) => (
              <AnimeCard
                key={anime.ID}
                id={anime.ID}
                name={anime.name}
                poster={anime.poster}
                imdb={anime.imdb_point}
                type={anime.type}
                className="h-full"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
