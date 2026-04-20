"use client";
import { useTheme } from "next-themes";
import { Moon, Sun, Smartphone } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const CYCLE = ["light", "dark", "oled"] as const;

export function ThemeToggle({ className }: { className?: string } = {}) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  function cycle() {
    const current = theme ?? "dark";
    const idx = CYCLE.indexOf(current as (typeof CYCLE)[number]);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }

  const icon = mounted
    ? theme === "oled"
      ? <Smartphone className="h-4 w-4" />
      : theme === "light"
        ? <Moon className="h-4 w-4" />
        : <Sun className="h-4 w-4" />
    : <span className="h-4 w-4" />;

  return (
    <button
      type="button"
      aria-label="Tema değiştir"
      onClick={cycle}
      suppressHydrationWarning
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition hover:bg-[var(--muted)]",
        className
      )}
    >
      {icon}
    </button>
  );
}
