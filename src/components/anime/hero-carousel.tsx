"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AniziumImage } from "./anizium-image";
import { Play, Info, ChevronLeft, ChevronRight, Star, Pause, Calendar } from "lucide-react";
import type { AnimeData } from "@/lib/anizium/schemas";
import { truncate, formatAnimeType } from "@/lib/utils";

export type HeroItem = AnimeData & {
  banner?: string | null;
  logo?: string | null;
  release_year?: number | string | null;
};

const AUTO_MS = 7000;

export function HeroCarousel({ items }: { items: HeroItem[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const list = items.slice(0, 6);
  const total = list.length;

  useEffect(() => {
    if (total < 2 || paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % total), AUTO_MS);
    return () => clearInterval(id);
  }, [total, paused, idx]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || total < 2) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;
      // Min 50px horizontal, < 500ms, more horizontal than vertical
      if (Math.abs(dx) < 50 || dt > 500 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) {
        setIdx((i) => (i + 1) % total);
      } else {
        setIdx((i) => (i - 1 + total) % total);
      }
    },
    [total]
  );

  if (total === 0) return null;
  const item = list[idx];
  const rating =
    typeof item.imdb_point === "number"
      ? item.imdb_point
      : item.imdb_point
      ? Number(item.imdb_point)
      : null;

  return (
    <section
      className="relative isolate h-[70vh] md:h-[88vh] min-h-[480px] md:min-h-[560px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background stack with crossfade + subtle zoom (Ken Burns) */}
      {list.map((a, i) => {
        const bg = a.banner || a.poster;
        const active = i === idx;
        return (
          <div
            key={a.ID}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
            style={{ opacity: active ? 1 : 0, zIndex: active ? 1 : 0 }}
            aria-hidden={!active}
          >
            {bg && (
              <AniziumImage
                src={bg}
                alt={a.name}
                fill
                priority={i === 0}
                sizes="100vw"
                className={`object-cover object-center ${active ? "hero-kenburns" : ""}`}
              />
            )}
            {/* Cinematic gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/55 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/70 to-transparent md:via-[var(--background)]/50" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_0%,rgba(0,0,0,0.35)_70%)]" />
            {/* Film grain */}
            <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.08] hero-grain" />
          </div>
        );
      })}

      {/* Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 sm:px-6 pb-24 md:pb-28">
        <div key={item.ID} className="max-w-2xl hero-fade-in">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)] backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary)]" />
            Öne Çıkan · #{idx + 1}
          </div>

          {item.logo ? (
            <div className="relative h-24 md:h-32 lg:h-40 w-full max-w-md md:max-w-lg drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
              <AniziumImage
                src={item.logo}
                alt={item.name}
                fill
                priority
                sizes="(min-width: 768px) 512px, 384px"
                className="object-contain object-left"
              />
            </div>
          ) : (
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02] drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)] text-balance">
              <span className="hero-gradient-text">{item.name}</span>
            </h1>
          )}

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {rating && rating > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-yellow-400">
                <Star className="h-4 w-4 fill-current" />
                {rating.toFixed(1)}
              </span>
            )}
            {item.release_year && (
              <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
                <Calendar className="h-3.5 w-3.5" />
                {item.release_year}
              </span>
            )}
            {item.type && (
              <span className="rounded-md border border-[var(--border)] bg-[var(--card)]/60 backdrop-blur px-2 py-0.5 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
                {formatAnimeType(item.type)}
              </span>
            )}
            {item.genre && item.genre.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.genre.slice(0, 4).map((g) => (
                  <span
                    key={g.ID}
                    className="rounded-full border border-[var(--border)] bg-[var(--card)]/70 backdrop-blur px-2.5 py-0.5 text-[11px] text-[var(--muted-foreground)]"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {item.overview && (
            <p className="mt-5 max-w-xl text-sm md:text-base leading-relaxed text-[var(--muted-foreground)]">
              {truncate(item.overview, 240)}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={`/anime/${encodeURIComponent(item.ID)}`}
              className="group/btn relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--primary)] px-6 py-3 md:px-6 md:py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_12px_30px_-10px_var(--primary)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_18px_40px_-10px_var(--primary)] min-h-[44px]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
              <Play className="h-4 w-4 fill-current" />
              Şimdi İzle
            </Link>
            <Link
              href={`/anime/${encodeURIComponent(item.ID)}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/60 px-6 py-3 text-sm font-semibold backdrop-blur-md transition-all duration-300 hover:border-[var(--foreground)]/40 hover:bg-[var(--card)]/80 min-h-[44px]"
            >
              <Info className="h-4 w-4" />
              Detaylar
            </Link>
          </div>
        </div>
      </div>

      {/* Thumbnail nav (desktop) */}
      {total > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:block">
          <div className="pointer-events-auto mx-auto max-w-7xl px-6 pb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIdx((i) => (i - 1 + total) % total)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]/60 backdrop-blur transition hover:scale-105 hover:bg-[var(--card)]"
                  aria-label="Önceki"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIdx((i) => (i + 1) % total)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]/60 backdrop-blur transition hover:scale-105 hover:bg-[var(--card)]"
                  aria-label="Sonraki"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]/60 backdrop-blur transition hover:bg-[var(--card)]"
                  aria-label={paused ? "Oynat" : "Duraklat"}
                >
                  {paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {list.map((a, i) => {
                  const active = i === idx;
                  const thumb = a.poster || a.banner;
                  return (
                    <button
                      key={a.ID}
                      onClick={() => setIdx(i)}
                      aria-label={`Slayt ${i + 1}: ${a.name}`}
                      className={`relative h-14 overflow-hidden rounded-lg border transition-all duration-300 ${
                        active
                          ? "w-24 border-[var(--primary)] shadow-lg shadow-[var(--primary)]/30"
                          : "w-12 border-[var(--border)] opacity-60 hover:opacity-100"
                      }`}
                    >
                      {thumb && (
                        <AniziumImage
                          src={thumb}
                          alt={a.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      )}
                      {active && !paused && (
                        <span
                          key={`p-${idx}`}
                          className="absolute bottom-0 left-0 h-0.5 bg-[var(--primary)] hero-progress"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile dots */}
      {total > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 md:hidden">
          {list.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slayt ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-8 bg-[var(--primary)]" : "w-4 bg-[var(--muted-foreground)]/40"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
