"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Play, Sparkles } from "lucide-react";
import { AniziumImage } from "@/components/anime/anizium-image";
import type { EpisodeData } from "@/lib/anizium/schemas";
import { cn } from "@/lib/utils";

interface Props {
  animeId: string;
  animeName: string;
  fallbackPoster?: string | null;
  episodes: EpisodeData[];
  activeEpisodeId: string;
  seasonName?: string;
}

export function YouTubeEpisodeRail({
  animeId,
  fallbackPoster,
  episodes,
  activeEpisodeId,
  seasonName,
}: Props) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const el = activeRef.current;
      const container = containerRef.current;
      const scrollLeft = el.offsetLeft - container.offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    }
  }, [activeEpisodeId]);

  if (!episodes || episodes.length === 0) return null;

  return (
    <div className="mt-8 border-t border-[var(--border)] pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[var(--foreground)] md:text-lg">
            {seasonName ?? "Bölümler"}
          </h3>
          <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted-foreground)]">
            {episodes.length} bölüm
          </span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] hidden sm:block">
          Kaydırarak diğer bölümlere geç
        </p>
      </div>

      <div
        ref={containerRef}
        className="flex gap-3.5 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth -mx-4 px-4 sm:-mx-6 sm:px-6"
      >
        {episodes.map((ep) => {
          const isActive = ep.ID === activeEpisodeId;
          const epNumber =
            typeof ep.number === "number"
              ? ep.number
              : ep.number
              ? Number(ep.number)
              : null;
          const thumbnail = ep.banner_link || fallbackPoster;

          return (
            <Link
              key={ep.ID}
              ref={isActive ? activeRef : undefined}
              href={`/izle/${encodeURIComponent(animeId)}/${encodeURIComponent(ep.ID)}`}
              className={cn(
                "group relative flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl border bg-[var(--card)] transition-all duration-300 sm:w-64",
                isActive
                  ? "border-[var(--primary)] shadow-lg shadow-[var(--primary)]/20 ring-1 ring-[var(--primary)]"
                  : "border-[var(--border)] hover:border-[var(--border)]/80 hover:shadow-md"
              )}
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-[var(--muted)]">
                {thumbnail ? (
                  <AniziumImage
                    src={thumbnail}
                    alt={ep.name}
                    fill
                    sizes="(max-width: 640px) 240px, 260px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
                    Görsel yok
                  </div>
                )}

                {/* Episode Number Badge */}
                <div className="absolute left-2 top-2 z-10">
                  <span
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-md backdrop-blur-md",
                      isActive
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-black/75 text-white"
                    )}
                  >
                    {epNumber != null ? `Bölüm ${epNumber}` : "Bölüm"}
                  </span>
                </div>

                {/* Playing Indicator Badge */}
                {isActive && (
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                    <Sparkles className="h-3 w-3" />
                    <span>Oynatılıyor</span>
                  </div>
                )}

                {/* Hover Play Button */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg shadow-black/50 transition-transform duration-300 group-hover:scale-110">
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Title & Info */}
              <div className="p-3 flex flex-col justify-between flex-1 gap-1.5">
                <p
                  className={cn(
                    "text-xs font-bold leading-snug line-clamp-2 transition-colors",
                    isActive ? "text-[var(--primary)]" : "text-[var(--foreground)] group-hover:text-[var(--primary)]"
                  )}
                >
                  {ep.name}
                </p>

                {ep.overview && (
                  <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 leading-relaxed">
                    {ep.overview}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
