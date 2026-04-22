"use client";
import Link from "next/link";
import Image from "next/image";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useHistory } from "@/hooks/use-history";
import { clearHistory, removeHistoryItem } from "@/lib/storage/history";
import { formatDuration } from "@/lib/utils";
import { Heart, Play, Sparkles, Trash2, X } from "lucide-react";

export default function GecmisPage() {
  const history = useHistory();
  const { confirm } = useConfirm();

  async function handleClearHistory() {
    const ok = await confirm({
      title: "Tüm geçmişi temizle",
      description: "İzleme geçmişinin tamamı silinecek.",
      confirmText: "Temizle",
      cancelText: "Vazgeç",
      variant: "danger",
    });
    if (ok) clearHistory();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">İzleme Geçmişi</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Kaldığın bölümden dön, favorilere taşı ve sonraki oturum için akışını canlı tut.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/kesfet" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]">
            <Sparkles className="h-4 w-4" /> Yeni bölüm bul
          </Link>
          <Link href="/favoriler" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]">
            <Heart className="h-4 w-4" /> Favorilere dön
          </Link>
          {history.length > 0 && (
            <button
              onClick={() => void handleClearHistory()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm hover:bg-[var(--muted)]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Tümünü Temizle
            </button>
          )}
        </div>
      </header>

      {history.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[linear-gradient(180deg,var(--card),color-mix(in_oklab,var(--card) 82%,var(--primary) 18%))] px-6 py-14 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary)]/12 text-[var(--primary)]">
            <Play className="h-7 w-7 fill-current" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-tight">İlk izleme oturumunu başlat</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--muted-foreground)] md:text-base">
            Bir bölüm açtığında ilerlemen burada saklanır. Sonra kaldığın yerden devam etmen ve favorilere taşıman kolaylaşır.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/kesfet" className="inline-flex items-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)]">
              İzlemeye başla
            </Link>
            <Link href="/top" className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold">
              Trend içerikleri aç
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Aktif kayıt</p>
              <p className="mt-3 text-2xl font-black">{history.length}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Devam edilebilir bölüm sayısı</p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Son oturum</p>
              <p className="mt-3 text-lg font-bold line-clamp-1">{history[0]?.animeName}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Kaldığın içerikten hemen devam et</p>
            </div>
          </section>

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
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <Link href={`/izle/${encodeURIComponent(h.animeId)}/${encodeURIComponent(h.episodeId)}`} className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-[var(--primary-foreground)]">
                      Kaldığın yerden devam et
                    </Link>
                    <Link href={`/anime/${encodeURIComponent(h.animeId)}`} className="rounded-full border border-[var(--border)] px-3 py-1.5">
                      Anime sayfasını aç
                    </Link>
                  </div>
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
        </div>
      )}
    </div>
  );
}
