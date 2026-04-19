import { AnimeCard, AnimeCardSkeleton } from "./anime-card";
import type { AnimeData } from "@/lib/anizium/schemas";

export function AnimeGrid({ items }: { items: AnimeData[] }) {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-[var(--muted-foreground)]">
        Sonuç bulunamadı.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      {items.map((a) => (
        <AnimeCard
          key={a.ID}
          id={a.ID}
          name={a.name}
          poster={a.poster}
          imdb={a.imdb_point}
          type={a.type}
        />
      ))}
    </div>
  );
}

export function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );
}
