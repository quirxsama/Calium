"use client";
import { useEffect, useState, useRef } from "react";
import { readFavorites, clearFavorites, type FavoriteEntry } from "@/lib/storage/favorites";

export function useFavorites(): FavoriteEntry[] {
  const [list, setList] = useState<FavoriteEntry[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    const update = () => setList(readFavorites());
    update();

    const onLogout = () => { clearFavorites(); };
    if (!synced.current) {
      window.addEventListener("calium:auth-logout", onLogout);
      synced.current = true;
    }

    window.addEventListener("animes:favorites-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("animes:favorites-changed", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("calium:auth-logout", onLogout);
    };
  }, []);
  return list;
}
