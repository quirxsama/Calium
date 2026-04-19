"use client";
import { useEffect, useState } from "react";
import { readFavorites, type FavoriteEntry } from "@/lib/storage/favorites";

export function useFavorites(): FavoriteEntry[] {
  const [list, setList] = useState<FavoriteEntry[]>([]);
  useEffect(() => {
    const update = () => setList(readFavorites());
    update();
    window.addEventListener("animes:favorites-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("animes:favorites-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return list;
}
