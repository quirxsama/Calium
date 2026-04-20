"use client";

import type { PresenceStatus } from "@/lib/realtime/presence";
import { cn } from "@/lib/utils";

const COLOR: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  dnd: "bg-rose-500",
  invisible: "bg-transparent",
  offline: "bg-[var(--muted-foreground)]/40",
};

const LABEL: Record<PresenceStatus, string> = {
  online: "Çevrimiçi",
  away: "Uzakta",
  dnd: "Rahatsız Etmeyin",
  invisible: "Çevrimdışı görün",
  offline: "Çevrimdışı",
};

export function PresenceDot({
  status,
  className,
  withRing = true,
}: {
  status: PresenceStatus;
  className?: string;
  withRing?: boolean;
}) {
  return (
    <span
      aria-label={LABEL[status]}
      title={LABEL[status]}
      className={cn(
        "inline-block h-3 w-3 rounded-full",
        COLOR[status],
        withRing && "ring-2 ring-[var(--card)]",
        className
      )}
    />
  );
}

export function activityText(a: {
  kind: string;
  animeTitle?: string | null;
  episode?: number | null;
  roomId?: string | null;
} | null): string | null {
  if (!a) return null;
  if (a.kind === "watching" && a.animeTitle) {
    return a.episode ? `${a.animeTitle} — Bölüm ${a.episode}` : a.animeTitle;
  }
  if (a.kind === "in_room") return "Bir odada izliyor";
  return null;
}
