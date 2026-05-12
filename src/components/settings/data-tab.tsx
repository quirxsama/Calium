"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { RefreshCw, Download, Trash2, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  clearLocalFavorites,
  clearPendingFavoriteClear,
  hasPendingFavoriteClear,
  readPendingFavoriteUpserts,
  readDeletedFavoriteIds,
  removeDeletedFavoriteIds,
  removePendingFavoriteUpserts,
} from "@/lib/storage/favorites";
import {
  clearLocalHistory,
  clearPendingHistoryClear,
  hasPendingHistoryClear,
  readPendingHistoryUpserts,
  readDeletedHistoryIds,
  removeDeletedHistoryIds,
  removePendingHistoryUpserts,
} from "@/lib/storage/history";

async function syncFetch(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error ?? "Senkronizasyon başarısız.");
  }
  return data;
}

export function DataTab() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function syncToServer() {
    setSyncing(true);
    setMessage(null);
    try {
      if (hasPendingFavoriteClear()) {
        await syncFetch("/api/sync/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
        clearPendingFavoriteClear();
      } else {
        const deletedFavoriteIds = readDeletedFavoriteIds();
        if (deletedFavoriteIds.length > 0) {
          await syncFetch("/api/sync/favorites", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ animeIds: deletedFavoriteIds }),
          });
          removeDeletedFavoriteIds(deletedFavoriteIds);
        }
      }

      if (hasPendingHistoryClear()) {
        await syncFetch("/api/sync/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
        clearPendingHistoryClear();
      } else {
        const deletedHistoryIds = readDeletedHistoryIds();
        if (deletedHistoryIds.length > 0) {
          await syncFetch("/api/sync/history", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ animeIds: deletedHistoryIds }),
          });
          removeDeletedHistoryIds(deletedHistoryIds);
        }
      }

      // Push favorites
      const favorites = readPendingFavoriteUpserts();
      if (favorites.length > 0) {
        await syncFetch("/api/sync/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorites }),
        });
        removePendingFavoriteUpserts(favorites.map((favorite) => favorite.id));
      }

      // Push history
      const history = readPendingHistoryUpserts();
      if (history.length > 0) {
        await syncFetch("/api/sync/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history }),
        });
        removePendingHistoryUpserts(history.map((entry) => entry.animeId));
      }

      // Pull from server
      const [favData, histData] = await Promise.all([
        syncFetch("/api/sync/favorites", { cache: "no-store" }),
        syncFetch("/api/sync/history", { cache: "no-store" }),
      ]);

      if (favData.success) {
        localStorage.setItem("animes:favorites", JSON.stringify(favData.favorites));
        window.dispatchEvent(new CustomEvent("animes:favorites-changed"));
      }
      if (histData.success) {
        localStorage.setItem("animes:history", JSON.stringify(histData.history));
        window.dispatchEvent(new CustomEvent("animes:history-changed"));
      }

      setMessage({ type: "success", text: "Veriler senkronize edildi." });
    } catch {
      setMessage({ type: "error", text: "Senkronizasyon başarısız." });
    }
    setSyncing(false);
  }

  function exportData() {
    const data = {
      favorites: JSON.parse(localStorage.getItem("animes:favorites") || "[]"),
      history: JSON.parse(localStorage.getItem("animes:history") || "[]"),
      captionSettings: JSON.parse(localStorage.getItem("animes:caption-settings") || "{}"),
      playerPrefs: JSON.parse(localStorage.getItem("calium:player-prefs") || "{}"),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calium-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function clearLocal() {
    const ok = await confirm({
      title: "Yerel verileri sil",
      description: "Tarayıcıdaki favori, geçmiş ve ayarlar temizlenecek.",
      confirmText: "Sil",
      cancelText: "Vazgeç",
      variant: "danger",
    });
    if (!ok) return;
    clearLocalFavorites();
    clearLocalHistory();
    localStorage.removeItem("animes:caption-settings");
    localStorage.removeItem("calium:player-prefs");
    setMessage({ type: "success", text: "Yerel veriler silindi." });
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Veri</h2>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">
        Verilerinizi senkronize edin, dışa aktarın veya silin.
      </p>

      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${message.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="max-w-lg space-y-4">
        {user && (
          <button
            onClick={syncToServer}
            disabled={syncing}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:bg-[var(--muted)]"
          >
            {syncing ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            ) : (
              <RefreshCw className="h-5 w-5 text-[var(--primary)]" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">Sunucu ile Senkronize Et</p>
              <p className="text-xs text-[var(--muted-foreground)]">Favori ve geçmiş verilerinizi sunucuya yedekleyin</p>
            </div>
          </button>
        )}

        <button
          onClick={exportData}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:bg-[var(--muted)]"
        >
          <Download className="h-5 w-5 text-[var(--primary)]" />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Verileri İndir</p>
            <p className="text-xs text-[var(--muted-foreground)]">JSON formatında tüm verilerinizi dışa aktarın</p>
          </div>
        </button>

        <button
          onClick={clearLocal}
          className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left transition hover:bg-red-500/10"
        >
          <Trash2 className="h-5 w-5 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-400">Yerel Verileri Sil</p>
            <p className="text-xs text-[var(--muted-foreground)]">Tarayıcıdaki tüm favori, geçmiş ve ayarları temizleyin</p>
          </div>
        </button>
      </div>
    </div>
  );
}
