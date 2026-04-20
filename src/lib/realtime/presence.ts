"use client";

import { useEffect, useRef, useState } from "react";
import { getRealtimeSocket } from "./socket";

export type PresenceStatus = "online" | "away" | "dnd" | "invisible" | "offline";

export type PresenceActivity = {
  kind: string;
  animeId?: string | null;
  animeTitle?: string | null;
  episode?: number | null;
  roomId?: string | null;
} | null;

export type PresenceState = {
  status: PresenceStatus;
  activity: PresenceActivity;
  updatedAt?: number;
};

type SnapshotEntry = { userId: string } & PresenceState;

/**
 * Verilen userId listesi için real-time presence durumunu döner.
 * İlk subscribe'da snapshot alınır, sonra event'lerle güncellenir.
 */
export function usePresenceSubscribe(userIds: string[]): Map<string, PresenceState> {
  const [map, setMap] = useState<Map<string, PresenceState>>(() => new Map());
  // Stable key for userId set
  const key = [...userIds].sort().join(",");
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    if (!userIds.length) {
      setMap(new Map());
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const sock = getRealtimeSocket();

    function sendSubscribe() {
      sock.send({ t: "presence.subscribe", userIds });
    }
    // İlk abone
    sendSubscribe();
    // Bağlantı yeni açılırsa tekrar abone olmamız gerekebilir.
    const reSub = () => sendSubscribe();
    window.addEventListener("focus", reSub);

    function onEvent(e: Event) {
      const detail = (e as CustomEvent).detail as Record<string, unknown>;
      if (!detail) return;
      if (detail.t === "presence.snapshot") {
        const entries = (detail.entries as SnapshotEntry[]) ?? [];
        setMap((prev) => {
          const next = new Map(prev);
          for (const it of entries) next.set(it.userId, { status: it.status, activity: it.activity, updatedAt: it.updatedAt });
          return next;
        });
      } else if (detail.t === "presence.event") {
        const uid = String(detail.userId ?? "");
        if (!uid || !userIds.includes(uid)) return;
        setMap((prev) => {
          const next = new Map(prev);
          next.set(uid, {
            status: (detail.status as PresenceStatus) ?? "online",
            activity: (detail.activity as PresenceActivity) ?? null,
            updatedAt: Date.now(),
          });
          return next;
        });
      }
    }

    window.addEventListener("calium:presence-event", onEvent);
    return () => {
      window.removeEventListener("calium:presence-event", onEvent);
      window.removeEventListener("focus", reSub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}

/**
 * Bu oturumun kendi presence aktivitesini yayar. Unmount'ta otomatik "online" döner.
 */
export function usePublishActivity(activity: PresenceActivity) {
  useEffect(() => {
    const sock = getRealtimeSocket();
    sock.send({ t: "presence.update", status: "online", activity });
    return () => {
      sock.send({ t: "presence.update", status: "online", activity: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activity)]);
}
