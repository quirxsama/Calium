"use client";
import { useEffect, useState } from "react";
import { readHistory, type HistoryEntry } from "@/lib/storage/history";

export function useHistory(): HistoryEntry[] {
  const [list, setList] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    const update = () => setList(readHistory());
    update();
    window.addEventListener("animes:history-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("animes:history-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return list;
}
