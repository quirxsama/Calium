"use client";

import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  readCaptionSettings,
  writeCaptionSettings,
  resetCaptionSettings,
  FONT_FAMILY_LABELS,
  type CaptionSettings,
  type CaptionFontFamily,
  type CaptionBackground,
  type CaptionOutline,
} from "@/lib/storage/caption-settings";

const FONTS: CaptionFontFamily[] = ["archia", "noto-sans", "inter", "nunito", "system"];
const BACKGROUNDS: { value: CaptionBackground; label: string }[] = [
  { value: "none", label: "Yok" },
  { value: "dim", label: "Loş" },
  { value: "solid", label: "Katı" },
];
const OUTLINES: { value: CaptionOutline; label: string }[] = [
  { value: "none", label: "Yok" },
  { value: "thin", label: "İnce" },
  { value: "medium", label: "Orta" },
  { value: "thick", label: "Kalın" },
];

export function CaptionTab() {
  const [settings, setSettings] = useState<CaptionSettings | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSettings(readCaptionSettings()));
  }, []);

  if (!settings) return null;

  function update(partial: Partial<CaptionSettings>) {
    const next = { ...settings!, ...partial };
    setSettings(next);
    writeCaptionSettings(partial);
  }

  function handleReset() {
    resetCaptionSettings();
    setSettings(readCaptionSettings());
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Altyazı</h2>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">Altyazı görünümünü özelleştirin.</p>

      <div className="max-w-lg space-y-6">
        {/* Font */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Yazı Tipi</p>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <button
                key={f}
                onClick={() => update({ fontFamily: f })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  settings.fontFamily === f
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {FONT_FAMILY_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
            Boyut: {(settings.fontSizeScale * 100).toFixed(0)}%
          </p>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={settings.fontSizeScale}
            onChange={(e) => update({ fontSizeScale: parseFloat(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </div>

        {/* Color */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Renk</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.textColor}
              onChange={(e) => update({ textColor: e.target.value })}
              className="h-9 w-9 cursor-pointer rounded-lg border border-[var(--border)]"
            />
            <span className="text-sm text-[var(--muted-foreground)]">{settings.textColor}</span>
          </div>
        </div>

        {/* Background */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Arka Plan</p>
          <div className="flex gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.value}
                onClick={() => update({ background: b.value })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  settings.background === b.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Outline */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Kenar Çizgisi</p>
          <div className="flex gap-2">
            {OUTLINES.map((o) => (
              <button
                key={o.value}
                onClick={() => update({ outline: o.value })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition",
                  settings.outline === o.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shadow toggle */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Gölge</p>
            <p className="text-xs text-[var(--muted-foreground)]">Metin altına gölge ekle</p>
          </div>
          <button
            type="button"
            onClick={() => update({ shadow: !settings.shadow })}
            className={cn(
              "relative h-6 w-10 rounded-full transition",
              settings.shadow ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
            )}
            aria-label="Gölge"
          >
            <div className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              settings.shadow ? "translate-x-4" : "translate-x-0.5"
            )} />
          </button>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
        >
          <RotateCcw className="h-4 w-4" />
          Varsayılana Sıfırla
        </button>
      </div>
    </div>
  );
}
