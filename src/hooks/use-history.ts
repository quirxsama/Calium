"use client";
import { useEffect, useState, useRef } from "react";
import { readHistory, clearLocalHistory, type HistoryEntry } from "@/lib/storage/history";

export function useHistory(): HistoryEntry[] {
  const [list, setList] = useState<HistoryEntry[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    const update = () => setList(readHistory());
    update();

    const onLogout = () => { clearLocalHistory(); };
    if (!synced.current) {
      window.addEventListener("calium:auth-logout", onLogout);
      synced.current = true;
    }

    window.addEventListener("animes:history-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("animes:history-changed", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("calium:auth-logout", onLogout);
    };
  }, []);
  return list;
}
