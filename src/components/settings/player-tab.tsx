"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const QUALITIES = [
  { value: "auto", label: "Otomatik" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
];

export function PlayerTab() {
  const [autoPlay, setAutoPlay] = useState(true);
  const [defaultQuality, setDefaultQuality] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("calium:player-prefs");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed.autoPlay === "boolean") setAutoPlay(parsed.autoPlay);
        if (typeof parsed.defaultQuality === "string") setDefaultQuality(parsed.defaultQuality);
      } catch { /* ignore */ }
    }
  }, []);

  async function handleSave() {
    setLoading(true);
    setMessage(null);

    const prefs = { autoPlay, defaultQuality };
    localStorage.setItem("calium:player-prefs", JSON.stringify(prefs));

    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    } catch { /* sync best-effort */ }

    setLoading(false);
    setMessage({ type: "success", text: "Oynatıcı ayarları kaydedildi." });
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Oynatıcı</h2>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">Video oynatıcı tercihlerinizi ayarlayın.</p>

      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${message.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <div className="max-w-lg space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Otomatik Oynat</p>
            <p className="text-xs text-[var(--muted-foreground)]">Bölüm bitince sonraki bölüme geç</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            className={cn(
              "relative h-6 w-10 rounded-full transition",
              autoPlay ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
            )}
            aria-label="Otomatik oynat"
          >
            <div className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              autoPlay ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Varsayılan Kalite</p>
          <div className="flex flex-wrap gap-2">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                onClick={() => setDefaultQuality(q.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  defaultQuality === q.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </button>
      </div>
    </div>
  );
}
