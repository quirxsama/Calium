"use client";
import { useEffect, useState, useRef } from "react";
import { readHistory, clearHistory, type HistoryEntry } from "@/lib/storage/history";

async function syncHistory() {
  try {
    const local = readHistory();
    if (local.length > 0) {
      await fetch("/api/sync/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: local }),
      });
    }
    const res = await fetch("/api/sync/history");
    const data = await res.json();
    if (data.success && Array.isArray(data.history)) {
      localStorage.setItem("animes:history", JSON.stringify(data.history));
      window.dispatchEvent(new CustomEvent("animes:history-changed"));
    }
  } catch { /* best-effort */ }
}

export function useHistory(): HistoryEntry[] {
  const [list, setList] = useState<HistoryEntry[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    const update = () => setList(readHistory());
    update();

    const onLogin = () => { syncHistory(); };
    const onLogout = () => { clearHistory(); };
    if (!synced.current) {
      window.addEventListener("calium:auth-login", onLogin);
      window.addEventListener("calium:auth-logout", onLogout);
      synced.current = true;
    }

    window.addEventListener("animes:history-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("animes:history-changed", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("calium:auth-login", onLogin);
      window.removeEventListener("calium:auth-logout", onLogout);
    };
  }, []);
  return list;
}
