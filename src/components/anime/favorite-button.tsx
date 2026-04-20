"use client";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/storage/favorites";

type Props = {
  id: string;
  name: string;
  poster?: string | null;
};

export function FavoriteButton({ id, name, poster }: Props) {
  const [fav, setFav] = useState(() => (typeof window !== "undefined" ? isFavorite(id) : false));
  const mounted = typeof window !== "undefined";

  useEffect(() => {
    queueMicrotask(() => setFav(isFavorite(id)));
    const onChange = () => setFav(isFavorite(id));
    window.addEventListener("animes:favorites-changed", onChange);
    return () => window.removeEventListener("animes:favorites-changed", onChange);
  }, [id]);

  function onClick() {
    toggleFavorite({ id, name, poster: poster ?? null });
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
        mounted && fav
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
      }`}
    >
      <Heart className={`h-4 w-4 ${mounted && fav ? "fill-[var(--primary)]" : ""}`} />
      {mounted && fav ? "Favoride" : "Favorile"}
    </button>
  );
}
