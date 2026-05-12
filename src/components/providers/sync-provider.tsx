"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  clearPendingFavoriteClear,
  hasPendingFavoriteClear,
  readDeletedFavoriteIds,
  readPendingFavoriteUpserts,
  removeDeletedFavoriteIds,
  removePendingFavoriteUpserts,
} from "@/lib/storage/favorites";
import {
  clearPendingHistoryClear,
  hasPendingHistoryClear,
  readDeletedHistoryIds,
  readPendingHistoryUpserts,
  removeDeletedHistoryIds,
  removePendingHistoryUpserts,
} from "@/lib/storage/history";

const FAVORITES_KEY = "animes:favorites";
const HISTORY_KEY = "animes:history";
const FAVORITES_EVENT = "animes:favorites-changed";
const HISTORY_EVENT = "animes:history-changed";
const SYNC_DEBOUNCE_MS = 1200;

async function fetchJson(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Senkronizasyon başarısız.");
  }
  return data;
}

function writeRemoteState(
  key: string,
  eventName: string,
  value: unknown[],
  applyingRemoteRef: MutableRefObject<boolean>
) {
  applyingRemoteRef.current = true;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(eventName));
  } finally {
    applyingRemoteRef.current = false;
  }
}

async function flushFavorites() {
  if (hasPendingFavoriteClear()) {
    await fetchJson("/api/sync/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    clearPendingFavoriteClear();
  } else {
    const deletedIds = readDeletedFavoriteIds();
    if (deletedIds.length > 0) {
      await fetchJson("/api/sync/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeIds: deletedIds }),
      });
      removeDeletedFavoriteIds(deletedIds);
    }
  }

  const local = readPendingFavoriteUpserts();
  if (local.length > 0) {
    await fetchJson("/api/sync/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorites: local }),
    });
    removePendingFavoriteUpserts(local.map((favorite) => favorite.id));
  }
}

async function pullFavorites(applyingRemoteRef: MutableRefObject<boolean>) {
  const data = await fetchJson("/api/sync/favorites", { cache: "no-store" });
  if (data.success && Array.isArray(data.favorites)) {
    if (hasPendingFavoriteClear()) return;
    const deletedIds = new Set(readDeletedFavoriteIds());
    const favorites = data.favorites.filter((favorite: { id?: unknown }) => {
      return typeof favorite.id === "string" && !deletedIds.has(favorite.id);
    });
    writeRemoteState(FAVORITES_KEY, FAVORITES_EVENT, favorites, applyingRemoteRef);
  }
}

async function syncFavoritesFromServer(applyingRemoteRef: MutableRefObject<boolean>) {
  await flushFavorites();
  await pullFavorites(applyingRemoteRef);
}

async function flushHistory() {
  if (hasPendingHistoryClear()) {
    await fetchJson("/api/sync/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    clearPendingHistoryClear();
  } else {
    const deletedIds = readDeletedHistoryIds();
    if (deletedIds.length > 0) {
      await fetchJson("/api/sync/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeIds: deletedIds }),
      });
      removeDeletedHistoryIds(deletedIds);
    }
  }

  const local = readPendingHistoryUpserts();
  if (local.length > 0) {
    await fetchJson("/api/sync/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: local }),
    });
    removePendingHistoryUpserts(local.map((entry) => entry.animeId));
  }
}

async function pullHistory(applyingRemoteRef: MutableRefObject<boolean>) {
  const data = await fetchJson("/api/sync/history", { cache: "no-store" });
  if (data.success && Array.isArray(data.history)) {
    if (hasPendingHistoryClear()) return;
    const deletedIds = new Set(readDeletedHistoryIds());
    const history = data.history.filter((entry: { animeId?: unknown }) => {
      return typeof entry.animeId === "string" && !deletedIds.has(entry.animeId);
    });
    writeRemoteState(HISTORY_KEY, HISTORY_EVENT, history, applyingRemoteRef);
  }
}

async function syncHistoryFromServer(applyingRemoteRef: MutableRefObject<boolean>) {
  await flushHistory();
  await pullHistory(applyingRemoteRef);
}

export function SyncProvider() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const favoritesTimerRef = useRef<number | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const applyingRemoteRef = useRef(false);
  const operationRef = useRef<Promise<void>>(Promise.resolve());

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

    const enqueueOperation = (operation: () => Promise<void>) => {
      const nextOperation = operationRef.current
        .catch(() => undefined)
        .then(operation)
        .catch(() => undefined);
      operationRef.current = nextOperation;
      return nextOperation;
    };

    const runLocalPush = () => {
      return enqueueOperation(async () => {
        await Promise.allSettled([flushFavorites(), flushHistory()]);
      });
    };

    const runServerPull = () => {
      return enqueueOperation(async () => {
        await Promise.allSettled([
          syncFavoritesFromServer(applyingRemoteRef),
          syncHistoryFromServer(applyingRemoteRef),
        ]);
      });
    };

    const scheduleFavoritesSync = () => {
      if (applyingRemoteRef.current) return;
      if (favoritesTimerRef.current) window.clearTimeout(favoritesTimerRef.current);
      favoritesTimerRef.current = window.setTimeout(() => {
        favoritesTimerRef.current = null;
        void runLocalPush();
      }, SYNC_DEBOUNCE_MS);
    };

    const scheduleHistorySync = () => {
      if (applyingRemoteRef.current) return;
      if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = window.setTimeout(() => {
        historyTimerRef.current = null;
        void runLocalPush();
      }, SYNC_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimers();
        void runLocalPush();
      }
    };

    const handleOnline = () => {
      void runLocalPush();
    };

    const handleBeforeUnload = () => {
      void runLocalPush();
    };

    void runServerPull();

    window.addEventListener(FAVORITES_EVENT, scheduleFavoritesSync);
    window.addEventListener(HISTORY_EVENT, scheduleHistorySync);
    window.addEventListener("online", handleOnline);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      window.removeEventListener(FAVORITES_EVENT, scheduleFavoritesSync);
      window.removeEventListener(HISTORY_EVENT, scheduleHistorySync);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loading, user, pathname]);

  return null;
}
