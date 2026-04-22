"use client";
import Link from "next/link";
import { useFavorites } from "@/hooks/use-favorites";
import { AnimeGrid } from "@/components/anime/anime-grid";
import type { AnimeData } from "@/lib/anizium/schemas";
import { Heart, Sparkles } from "lucide-react";

export default function FavorilerPage() {
  const favs = useFavorites();
  const items: AnimeData[] = favs.map((f) => ({
    ID: f.id,
    name: f.name,
    poster: f.poster ?? null,
    overview: null,
    imdb_point: null,
    type: null,
    genre: [],
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Favorilerim</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Favori animelerini görüntüle, tekrar aç ve yeni seçimlerle akışını zenginleştir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/kesfet"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]"
          >
            <Sparkles className="h-4 w-4" /> Yeni favori bul
          </Link>
          <Link
            href="/listelerim"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]"
          >
            <Heart className="h-4 w-4" /> Listeye taşı
          </Link>
        </div>
      </header>
      {items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[linear-gradient(180deg,var(--card),color-mix(in_oklab,var(--card) 78%,var(--primary) 22%))] px-6 py-14 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary)]/12 text-[var(--primary)]">
            <Heart className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-tight">Favori listen hazır bekliyor</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--muted-foreground)] md:text-base">
            Beğendiğin animeleri kaydet; sonra tek dokunuşla geri dön, listelere ekle ve kişisel öneri alanlarını besle.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/kesfet"
              className="inline-flex items-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
            >
              Favori keşfet
            </Link>
              <Link
                href="/top"
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold"
              >
                Top 100&apos;e git
              </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Geri dönüş akışı</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Favorilerden yeniden başla</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Kütüphanen büyüdükçe geri dönüş oranı artar. Son eklediğin içeriklere hızlıca dön veya yeni liste kur.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/listelerim" className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-semibold">
                  Liste oluştur
                </Link>
                <Link href="/kesfet" className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-semibold">
                  Benzer anime bul
                </Link>
              </div>
            </div>
          </section>

          <AnimeGrid items={items} />
        </div>
      )}
    </div>
  );
}
