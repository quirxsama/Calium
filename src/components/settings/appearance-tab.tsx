"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { key: "light", label: "Açık", icon: Sun },
  { key: "dark", label: "Koyu", icon: Moon },
  { key: "oled", label: "OLED Siyah", icon: Smartphone },
  { key: "system", label: "Sistem", icon: Monitor },
] as const;

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Görünüm</h2>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">Tema tercihlerinizi ayarlayın.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg">
        {THEMES.map((t) => {
          const Icon = t.icon;
          const active = theme === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 transition",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
