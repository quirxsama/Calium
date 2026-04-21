"use client";
import { useFavorites } from "@/hooks/use-favorites";
import { AnimeGrid } from "@/components/anime/anime-grid";
import type { AnimeData } from "@/lib/anizium/schemas";

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
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Favorilerim</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Favori animelerinizi buradan görüntüleyebilirsiniz.
        </p>
      </header>
      {items.length === 0 ? (
        <div className="py-20 text-center text-[var(--muted-foreground)]">
          Henüz favorin yok. Bir animenin sayfasından kalp ikonuna tıkla!
        </div>
      ) : (
        <AnimeGrid items={items} />
      )}
    </div>
  );
}
