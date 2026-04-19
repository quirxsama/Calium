"use client";
import Link from "next/link";
import Image from "next/image";
import { useHistory } from "@/hooks/use-history";
import { clearHistory, removeHistoryItem } from "@/lib/storage/history";
import { formatDuration } from "@/lib/utils";
import { Play, Trash2, X } from "lucide-react";

export default function GecmisPage() {
  const history = useHistory();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">İzleme Geçmişi</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Tarayıcınızda tutulur.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => confirm("Tüm geçmişi silmek istiyor musunuz?") && clearHistory()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Tümünü Temizle
          </button>
        )}
      </header>

      {history.length === 0 ? (
        <div className="py-20 text-center text-[var(--muted-foreground)]">
          Henüz izleme geçmişin yok.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((h) => {
            const pct = h.duration > 0 ? Math.min(100, Math.round((h.progress / h.duration) * 100)) : 0;
            return (
              <div
                key={`${h.animeId}-${h.episodeId}`}
                className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <Link
                  href={`/izle/${encodeURIComponent(h.animeId)}/${encodeURIComponent(h.episodeId)}`}
                  className="relative h-20 w-32 shrink-0 rounded-lg overflow-hidden bg-[var(--muted)]"
                >
                  {h.poster && (
                    <Image src={h.poster} alt={h.animeName} fill sizes="128px" className="object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition">
                    <Play className="h-6 w-6 fill-white text-white" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                    <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/anime/${encodeURIComponent(h.animeId)}`}
                    className="font-semibold hover:text-[var(--primary)] line-clamp-1"
                  >
                    {h.animeName}
                  </Link>
                  <p className="text-sm text-[var(--muted-foreground)] line-clamp-1">
                    {h.seasonNumber ? `S${h.seasonNumber} · ` : ""}
                    {h.episodeNumber ? `B${h.episodeNumber} · ` : ""}
                    {h.episodeName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {formatDuration(h.progress)} / {formatDuration(h.duration)} · %{pct}
                  </p>
                </div>
                <button
                  onClick={() => removeHistoryItem(h.animeId)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--muted)]"
                  aria-label="Kaldır"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
