"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useHistory } from "@/hooks/use-history";
import { removeHistoryItem } from "@/lib/storage/history";
import { formatDuration } from "@/lib/utils";

export function ContinueWatching() {
  const history = useHistory();
  const ref = useRef<HTMLDivElement>(null);
  if (!history.length) return null;

  function scroll(dir: 1 | -1) {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between px-1">
        <h2 className="section-title text-lg md:text-2xl font-bold tracking-tight">İzlemeye Devam Et</h2>
        <div className="hidden md:flex items-center gap-1">
          <button onClick={() => scroll(-1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]" aria-label="Sol">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]" aria-label="Sağ">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={ref} className="no-scrollbar flex gap-3 md:gap-4 overflow-x-auto pb-2">
        {history.map((h) => {
          const pct =
            h.duration > 0 ? Math.min(100, Math.round((h.progress / h.duration) * 100)) : 0;
          return (
            <div
              key={`${h.animeId}-${h.episodeId}`}
              className="relative shrink-0 w-40 sm:w-44 md:w-48 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card)]"
            >
              <Link
                href={`/izle/${encodeURIComponent(h.animeId)}/${encodeURIComponent(h.episodeId)}`}
                className="block group"
              >
                <div className="relative aspect-[2/3] w-full bg-[var(--muted)]">
                  {h.poster && (
                    <Image src={h.poster} alt={h.animeName} fill sizes="(min-width: 768px) 192px, 176px" className="object-cover transition group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]">
                      <Play className="h-3 w-3 fill-current" /> Devam Et
                    </span>
                  </div>
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                      <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold line-clamp-1">{h.animeName}</h3>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-1">
                    {h.seasonNumber ? `S${h.seasonNumber} · ` : ""}
                    {h.episodeNumber ? `B${h.episodeNumber} · ` : ""}
                    {h.episodeName}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    {formatDuration(h.progress)} / {formatDuration(h.duration)}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => removeHistoryItem(h.animeId)}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Kaldır"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
