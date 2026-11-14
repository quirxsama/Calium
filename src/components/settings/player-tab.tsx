"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePlayerPreferences, readPlayerPreferences, savePlayerPreferences } from "@/lib/storage/player-preferences";

const DUB_LANGUAGES = [
  { value: "en", label: "İngilizce" },
  { value: "tr", label: "Türkçe" },
  { value: "ja", label: "Japonca" },
] as const;

const QUALITIES = [
  { value: "auto", label: "Otomatik" },
  { value: "2160p", label: "2160p" },
  { value: "1440p", label: "1440p" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
];

export function PlayerTab() {
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoSkipIntro, setAutoSkipIntro] = useState(false);
  const [holdSpaceToSpeedUp, setHoldSpaceToSpeedUp] = useState(true);
  const [defaultQuality, setDefaultQuality] = useState("auto");
  const [defaultDubLanguage, setDefaultDubLanguage] = useState("ja");
  const editedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const applyPrefs = (preferences: unknown) => {
        const prefs = normalizePlayerPreferences(preferences);
        setAutoPlay(prefs.autoPlay);
        setAutoSkipIntro(prefs.autoSkipIntro);
        setHoldSpaceToSpeedUp(prefs.holdSpaceToSpeedUp);
        setDefaultQuality(prefs.defaultQuality);
        setDefaultDubLanguage(prefs.defaultDubLanguage);
      };
      applyPrefs(readPlayerPreferences());

      try {
        const res = await fetch("/api/preferences", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const preferences = data?.preferences;
        if (cancelled || editedRef.current || !preferences) return;

        const nextPrefs = normalizePlayerPreferences(preferences);
        applyPrefs(nextPrefs);
        savePlayerPreferences(nextPrefs);
      } catch {
        // sync best-effort
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    editedRef.current = true;
    setLoading(true);
    setMessage(null);

    const prefs = savePlayerPreferences(normalizePlayerPreferences({ autoPlay, autoSkipIntro, holdSpaceToSpeedUp, defaultQuality, defaultDubLanguage }));

    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Preference sync failed");
      setMessage({ type: "success", text: "Oynatıcı ayarları kaydedildi." });
    } catch {
      setMessage({ type: "error", text: "Ayarlar bu cihazda kaydedildi; hesabınızla eşitlenemedi." });
    } finally {
      setLoading(false);
    }
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

      <div className="max-w-lg space-y-6" onClickCapture={() => { editedRef.current = true; }}>
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Otomatik Oynat</p>
            <p className="text-xs text-[var(--muted-foreground)]">İzleme sayfası yüklendiğinde videoyu otomatik başlat</p>
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

        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Introyu Otomatik Atla</p>
            <p className="text-xs text-[var(--muted-foreground)]">Intro atlama görününce 3 saniye sonra otomatik geç</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoSkipIntro((v) => !v)}
            className={cn(
              "relative h-6 w-10 rounded-full transition",
              autoSkipIntro ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
            )}
            aria-label="Introyu otomatik atla"
          >
            <div className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              autoSkipIntro ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p id="space-speed-label" className="text-sm font-medium text-[var(--foreground)]">Space ile 2× Hız</p>
            <p id="space-speed-description" className="text-xs text-[var(--muted-foreground)]">Space tuşunu basılı tutarken 2× hızda izle. Kısa basış videoyu durdurur veya devam ettirir.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={holdSpaceToSpeedUp}
            aria-labelledby="space-speed-label"
            aria-describedby="space-speed-description"
            onClick={() => setHoldSpaceToSpeedUp((value) => !value)}
            className={cn(
              "relative h-6 w-10 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]",
              holdSpaceToSpeedUp ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
            )}
          >
            <span className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              holdSpaceToSpeedUp ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Varsayılan Dublaj Dili</p>
          <div className="flex flex-wrap gap-2">
            {DUB_LANGUAGES.map((language) => (
              <button
                key={language.value}
                onClick={() => setDefaultDubLanguage(language.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  defaultDubLanguage === language.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {language.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Seçilen dil yoksa oynatıcı otomatik olarak Japonca dublaja döner.</p>
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
