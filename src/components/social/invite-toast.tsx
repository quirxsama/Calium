"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users2, X, Check } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

type InvitePayload = {
  id: string;
  notificationId?: string;
  inviteId?: string;
  roomId?: string;
  roomCode?: string;
  inviteUrl?: string;
  animeName?: string;
  username?: string;
  displayName?: string | null;
  requesterId?: string;
  type?: string;
};

const TOAST_TYPES = new Set(["invite", "room_request", "room_join_request", "room_join_accepted", "offline_invite", "offline_invite_accepted"]);

const AUTO_DISMISS_MS = 15_000;

/**
 * WS üzerinden gelen `notification` event'lerinden `invite` tipinde olanları
 * sağ alt köşede pop-up olarak gösterir. DND açıksa hiç göstermez.
 */
export function InviteToast() {
  const { user } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<InvitePayload[]>([]);

  const dismiss = useCallback((id: string) => {
    setActive((list) => list.filter((i) => i.id !== id));
  }, []);

  async function respondToast(item: InvitePayload, action: "accept" | "decline") {
    dismiss(item.id);

    // room_join_accepted / offline_invite_accepted → link'e git (sadece kabul)
    if (item.type === "room_join_accepted" || item.type === "offline_invite_accepted") {
      if (item.inviteUrl) router.push(item.inviteUrl);
      return;
    }

    // room_join_request → host olarak kabul/reddet
    if (item.type === "room_join_request" && item.notificationId) {
      await fetch("/api/rooms/join-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: item.notificationId,
          requesterId: item.requesterId,
          roomId: item.roomId,
          action,
        }),
      });
      return;
    }

    // offline_invite → kabul/reddet
    if (item.type === "offline_invite" && item.notificationId) {
      const res = await fetch("/api/rooms/offline-invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.notificationId, action }),
      });
      const data = await res.json();
      if (action === "accept" && data.success && data.room?.inviteUrl) {
        router.push(data.room.inviteUrl);
      }
      return;
    }

    // invite (classic)
    if (!item.inviteId) {
      if (action === "accept" && item.inviteUrl) router.push(item.inviteUrl);
      else if (action === "accept" && item.roomId) router.push(`/oda/${item.roomId}`);
      return;
    }
    const res = await fetch("/api/rooms/invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: item.inviteId, action }),
    });
    const data = await res.json();
    if (action === "accept" && data.success && data.room?.id) {
      router.push(`/oda/${data.room.id}?code=${encodeURIComponent(data.room.code ?? "")}`);
    }
  }

  useEffect(() => {
    if (!user || user.dndEnabled) return;

    function onNotif(e: Event) {
      const detail = (e as CustomEvent).detail as Record<string, unknown>;
      if (!detail || detail.t !== "notification") return;
      if (!TOAST_TYPES.has(String(detail.type))) return;
      const p = (detail.payload ?? {}) as Record<string, unknown>;
      const entry: InvitePayload = {
        id: String(detail.id ?? `${Date.now()}-${Math.random()}`),
        notificationId: detail.id ? String(detail.id) : undefined,
        inviteId: p.inviteId ? String(p.inviteId) : undefined,
        roomId: p.roomId ? String(p.roomId) : undefined,
        roomCode: p.roomCode ? String(p.roomCode) : undefined,
        inviteUrl: p.inviteUrl ? String(p.inviteUrl) : undefined,
        animeName: p.animeName ? String(p.animeName) : undefined,
        username: p.username ? String(p.username) : undefined,
        displayName: (p.displayName as string | null) ?? null,
        requesterId: p.requesterId ? String(p.requesterId) : undefined,
        type: String(detail.type),
      };
      setActive((list) => [...list, entry]);
      // Ses
      try {
        playPing();
      } catch {}
      // Auto dismiss
      window.setTimeout(() => dismiss(entry.id), AUTO_DISMISS_MS);
    }

    window.addEventListener("calium:notification", onNotif);
    return () => window.removeEventListener("calium:notification", onNotif);
  }, [user, dismiss]);

  if (!user || user.dndEnabled || active.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[999] flex flex-col gap-2 md:bottom-4">
      {active.map((it) => (
        <div
          key={it.id}
          className="pointer-events-auto animate-room-chat-float w-[320px] overflow-hidden rounded-xl border border-[var(--primary)]/40 bg-[var(--card)] shadow-xl"
        >
          <div className="flex items-start gap-3 p-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary)]">
              <Users2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {toastTitle(it.type)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--foreground)]">
                  {it.displayName || it.username || "Biri"}
                </span>{" "}
                {toastBody(it)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(it.id)}
              aria-label="Kapat"
              className="rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--background)]/40 p-2">
            {(it.type === "room_join_accepted" || it.type === "offline_invite_accepted") ? (
              <button
                type="button"
                onClick={() => void respondToast(it, "accept")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> Odaya Git
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void respondToast(it, "accept")}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" /> {it.type === "room_join_request" || it.type === "offline_invite" ? "Kabul Et" : "Katıl"}
                </button>
                <button
                  type="button"
                  onClick={() => void respondToast(it, "decline")}
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                >
                  Reddet
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Web Audio API ile kısa bir ping sesi üretir — asset gerektirmez. */
function playPing() {
  if (typeof window === "undefined") return;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
  osc.onended = () => ctx.close();
}

function toastTitle(type?: string): string {
  switch (type) {
    case "room_join_request":
      return "Odaya katılma isteği";
    case "room_join_accepted":
      return "Katılma isteği kabul edildi";
    case "offline_invite":
      return "Birlikte izleme isteği";
    case "offline_invite_accepted":
      return "Davet kabul edildi — oda oluşturuldu";
    case "room_request":
      return "Birlikte izleme çağrısı";
    default:
      return "Birlikte izleme daveti";
  }
}

function toastBody(it: InvitePayload): string {
  const anime = it.animeName;
  switch (it.type) {
    case "room_join_request":
      return anime ? `${anime} odanıza katılmak istiyor.` : "odanıza katılmak istiyor.";
    case "room_join_accepted":
      return anime ? `${anime} odasına davet edildin.` : "katılma isteğini kabul etti.";
    case "offline_invite":
      return anime ? `seni ${anime} izlemeye çağırıyor.` : "seni birlikte izlemeye çağırıyor.";
    case "offline_invite_accepted":
      return anime ? `${anime} için oda oluşturuldu.` : "oda oluşturuldu.";
    case "room_request":
      return anime ? `seni ${anime} izlemeye çağırıyor.` : "seni birlikte izlemeye çağırıyor.";
    default:
      return anime ? `seni ${anime} izlemeye davet etti.` : "seni birlikte izlemeye davet etti.";
  }
}
