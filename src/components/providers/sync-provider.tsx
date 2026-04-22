"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { readFavorites } from "@/lib/storage/favorites";
import { readHistory } from "@/lib/storage/history";

const FAVORITES_KEY = "animes:favorites";
const HISTORY_KEY = "animes:history";
const FAVORITES_EVENT = "animes:favorites-changed";
const HISTORY_EVENT = "animes:history-changed";
const SYNC_DEBOUNCE_MS = 1200;
const POLL_INTERVAL_MS = 45000;

async function syncFavorites() {
  const local = readFavorites();
  if (local.length > 0) {
    await fetch("/api/sync/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorites: local }),
    });
  }

  const res = await fetch("/api/sync/favorites", { cache: "no-store" });
  const data = await res.json();
  if (data.success && Array.isArray(data.favorites)) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(data.favorites));
    window.dispatchEvent(new CustomEvent(FAVORITES_EVENT));
  }
}

async function syncHistory() {
  const local = readHistory();
  if (local.length > 0) {
    await fetch("/api/sync/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: local }),
    });
  }

  const res = await fetch("/api/sync/history", { cache: "no-store" });
  const data = await res.json();
  if (data.success && Array.isArray(data.history)) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
  }
}

export function SyncProvider() {
  const { user, loading } = useAuth();
  const favoritesTimerRef = useRef<number | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    const clearTimers = () => {
      if (favoritesTimerRef.current) {
        window.clearTimeout(favoritesTimerRef.current);
        favoritesTimerRef.current = null;
      }
      if (historyTimerRef.current) {
        window.clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };

    const runSync = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await Promise.allSettled([syncFavorites(), syncHistory()]);
      } finally {
        runningRef.current = false;
      }
    };

    const scheduleFavoritesSync = () => {
      if (favoritesTimerRef.current) window.clearTimeout(favoritesTimerRef.current);
      favoritesTimerRef.current = window.setTimeout(() => {
        favoritesTimerRef.current = null;
        void runSync();
      }, SYNC_DEBOUNCE_MS);
    };

    const scheduleHistorySync = () => {
      if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = window.setTimeout(() => {
        historyTimerRef.current = null;
        void runSync();
      }, SYNC_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimers();
        void runSync();
      }
    };

    const handleOnline = () => {
      void runSync();
    };

    const handleBeforeUnload = () => {
      void runSync();
    };

    void runSync();

    const pollId = window.setInterval(() => {
      void runSync();
    }, POLL_INTERVAL_MS);

    window.addEventListener(FAVORITES_EVENT, scheduleFavoritesSync);
    window.addEventListener(HISTORY_EVENT, scheduleHistorySync);
    window.addEventListener("online", handleOnline);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      window.clearInterval(pollId);
      window.removeEventListener(FAVORITES_EVENT, scheduleFavoritesSync);
      window.removeEventListener(HISTORY_EVENT, scheduleHistorySync);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loading, user]);

  return null;
}
