"use client";
import { useEffect, useState, useRef } from "react";
import { readFavorites, clearFavorites, type FavoriteEntry } from "@/lib/storage/favorites";

async function syncFavorites() {
  try {
    const local = readFavorites();
    if (local.length > 0) {
      await fetch("/api/sync/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: local }),
      });
    }
    const res = await fetch("/api/sync/favorites");
    const data = await res.json();
    if (data.success && Array.isArray(data.favorites)) {
      localStorage.setItem("animes:favorites", JSON.stringify(data.favorites));
      window.dispatchEvent(new CustomEvent("animes:favorites-changed"));
    }
  } catch { /* best-effort */ }
}

export function useFavorites(): FavoriteEntry[] {
  const [list, setList] = useState<FavoriteEntry[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    const update = () => setList(readFavorites());
    update();

    const onLogin = () => { syncFavorites(); };
    const onLogout = () => { clearFavorites(); };
    if (!synced.current) {
      window.addEventListener("calium:auth-login", onLogin);
      window.addEventListener("calium:auth-logout", onLogout);
      synced.current = true;
    }

    window.addEventListener("animes:favorites-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("animes:favorites-changed", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("calium:auth-login", onLogin);
      window.removeEventListener("calium:auth-logout", onLogout);
    };
  }, []);
  return list;
}
