"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { getRealtimeSocket } from "@/lib/realtime/socket";

/**
 * Oturum açmış kullanıcı varsa WS bağlantısını açar ve global event'ler yayınlar:
 *   - `calium:notification`   → NotificationBell refresh
 *   - `calium:presence-event` → presence listeners
 *   - `calium:room-event`     → room listeners
 */
export function RealtimeProvider() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const sock = getRealtimeSocket();
    const off = sock.subscribe((msg) => {
      const t = msg.t as string;
      if (!t) return;
      if (t === "notification") {
        window.dispatchEvent(new CustomEvent("calium:notification", { detail: msg }));
      } else if (t === "presence.event" || t === "presence.snapshot") {
        window.dispatchEvent(new CustomEvent("calium:presence-event", { detail: msg }));
      } else if (t.startsWith("room.")) {
        window.dispatchEvent(new CustomEvent("calium:room-event", { detail: msg }));
      }
    });
    return () => {
      off();
    };
  }, [user]);

  return null;
}
