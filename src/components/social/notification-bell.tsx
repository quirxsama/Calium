"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Inbox, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

type NotifItem = {
  id: string;
  type: string;
  payload: {
    inviteId?: string;
    actorId?: string;
    roomId?: string;
    roomCode?: string;
    inviteUrl?: string;
    targetUserId?: string;
    requesterId?: string;
    username?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    [k: string]: unknown;
  };
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, (p: NotifItem["payload"]) => string> = {
  follow: (p) => `${p.displayName || p.username} seni takip etmeye başladı`,
  follow_request: (p) => `${p.displayName || p.username} takip isteği gönderdi`,
  follow_accepted: (p) => `${p.displayName || p.username} takip isteğini kabul etti`,
  invite: (p) => `${p.displayName || p.username} seni birlikte izlemeye davet etti`,
  room_join: (p) => `${p.displayName || p.username} bir oda açtı`,
  room_request: (p) => `${p.displayName || p.username} birlikte izlemeye çağırıyor`,
  room_join_request: (p) => `${p.displayName || p.username} odanıza katılmak istiyor`,
  room_join_accepted: (p) => `${p.displayName || p.username} katılma isteğinizi kabul etti`,
  offline_invite: (p) => `${p.displayName || p.username} seni birlikte izlemeye çağırıyor`,
  offline_invite_accepted: (p) => `${p.displayName || p.username} davetinizi kabul etti — oda oluşturuldu`,
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) {
        setItems(data.items ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(refresh);
    // Safety-net polling (WS düşerse). WS event'i geldiğinde de anında refresh.
    const iv = setInterval(refresh, 120_000);
    function onRealtime() {
      refresh();
    }
    window.addEventListener("calium:notification", onRealtime);
    return () => {
      clearInterval(iv);
      window.removeEventListener("calium:notification", onRealtime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setUnread(0);
    setItems((list) => list.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
  }

  async function markRead(notifId: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [notifId] }),
    });
    setItems((list) => list.map((i) => (i.id === notifId ? { ...i, readAt: i.readAt ?? new Date().toISOString() } : i)));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function clearAll() {
    await fetch("/api/notifications", { method: "DELETE" });
    setItems([]);
    setUnread(0);
  }

  async function respondInvite(inviteId: string, notifId: string, action: "accept" | "decline") {
    const res = await fetch("/api/rooms/invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId, action }),
    });
    const data = await res.json();
    if (!data.success) return;

    setItems((list) => list.map((i) => (i.id === notifId ? { ...i, readAt: new Date().toISOString() } : i)));
    setUnread((count) => Math.max(0, count - 1));

    if (action === "accept" && data.room?.id) {
      window.location.href = `/oda/${data.room.id}?code=${encodeURIComponent(data.room.code ?? "")}`;
    }
  }

  async function respondJoinRequest(n: NotifItem, action: "accept" | "decline") {
    const res = await fetch("/api/rooms/join-request", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: n.id,
        requesterId: n.payload.requesterId,
        roomId: n.payload.roomId,
        action,
      }),
    });
    const data = await res.json();
    if (!data.success) return;
    setItems((list) => list.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function respondOfflineInvite(n: NotifItem, action: "accept" | "decline") {
    const res = await fetch("/api/rooms/offline-invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: n.id, action }),
    });
    const data = await res.json();
    if (!data.success) return;
    setItems((list) => list.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
    setUnread((c) => Math.max(0, c - 1));
    if (action === "accept" && data.room?.inviteUrl) {
      window.location.href = data.room.inviteUrl;
    }
  }

  if (!user) return null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label="Bildirimler"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-[var(--primary-foreground)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-sm font-semibold">Bildirimler</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <Check className="h-3 w-3" /> Okundu
                </button>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" /> Temizle
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="p-6 text-center text-xs text-[var(--muted-foreground)]">Yükleniyor…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 text-[var(--muted-foreground)]">
                <Inbox className="h-6 w-6" />
                <p className="text-xs">Bildirim yok.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((n) => {
                  const label = TYPE_LABEL[n.type]?.(n.payload) ?? n.type;
                  const href = linkFor(n);
                  const isRead = !!n.readAt;
                  const body = (
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          isRead ? "bg-transparent" : "bg-[var(--primary)]"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--foreground)]">{label}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                          {new Date(n.createdAt).toLocaleString("tr-TR")}
                        </p>
                      </div>
                    </div>
                  );

                  const isInvite = n.type === "invite" && typeof n.payload.inviteId === "string" && !isRead;
                  const isJoinRequest = n.type === "room_join_request" && !isRead;
                  const isOfflineInvite = n.type === "offline_invite" && !isRead;
                  const isRoomRequest = n.type === "room_request" && typeof n.payload.roomId === "string" && !isRead;
                  const hasRoomLink = (n.type === "room_join_accepted" || n.type === "offline_invite_accepted") && n.payload.inviteUrl;

                  return (
                    <li key={n.id}>
                      {isInvite ? (
                        <div className="block hover:bg-[var(--muted)]/40">
                          {body}
                          <div className="flex gap-2 px-3 pb-3">
                            <button
                              type="button"
                              onClick={() => respondInvite(String(n.payload.inviteId), n.id, "accept")}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
                            >
                              <Check className="h-3.5 w-3.5" /> Kabul Et
                            </button>
                            <button
                              type="button"
                              onClick={() => respondInvite(String(n.payload.inviteId), n.id, "decline")}
                              className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)]"
                            >
                              <X className="h-3.5 w-3.5" /> Reddet
                            </button>
                          </div>
                        </div>
                      ) : isJoinRequest ? (
                        <div className="block hover:bg-[var(--muted)]/40">
                          {body}
                          <div className="flex gap-2 px-3 pb-3">
                            <button
                              type="button"
                              onClick={() => respondJoinRequest(n, "accept")}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
                            >
                              <Check className="h-3.5 w-3.5" /> Kabul Et
                            </button>
                            <button
                              type="button"
                              onClick={() => respondJoinRequest(n, "decline")}
                              className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)]"
                            >
                              <X className="h-3.5 w-3.5" /> Reddet
                            </button>
                          </div>
                        </div>
                      ) : isOfflineInvite ? (
                        <div className="block hover:bg-[var(--muted)]/40">
                          {body}
                          <div className="flex gap-2 px-3 pb-3">
                            <button
                              type="button"
                              onClick={() => respondOfflineInvite(n, "accept")}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
                            >
                              <Check className="h-3.5 w-3.5" /> Kabul Et
                            </button>
                            <button
                              type="button"
                              onClick={() => respondOfflineInvite(n, "decline")}
                              className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)]"
                            >
                              <X className="h-3.5 w-3.5" /> Reddet
                            </button>
                          </div>
                        </div>
                      ) : isRoomRequest ? (
                        <div className="block hover:bg-[var(--muted)]/40">
                          {body}
                          <div className="flex gap-2 px-3 pb-3">
                            <Link
                              href={`/oda/${n.payload.roomId}?code=${encodeURIComponent(String(n.payload.roomCode ?? ""))}`}
                              onClick={() => { markRead(n.id); setOpen(false); }}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
                            >
                              <Check className="h-3.5 w-3.5" /> Odaya Git
                            </Link>
                          </div>
                        </div>
                      ) : hasRoomLink ? (
                        <Link
                          href={String(n.payload.inviteUrl)}
                          onClick={() => { markRead(n.id); setOpen(false); }}
                          className="block hover:bg-[var(--muted)]/40"
                        >
                          {body}
                          {!isRead && (
                            <div className="flex gap-2 px-3 pb-3">
                              <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]">
                                <Check className="h-3.5 w-3.5" /> Odaya Git
                              </span>
                            </div>
                          )}
                        </Link>
                      ) : href ? (
                        <Link href={href} onClick={() => { markRead(n.id); setOpen(false); }} className="block hover:bg-[var(--muted)]/40">
                          {body}
                        </Link>
                      ) : (
                        <div onClick={() => markRead(n.id)} className="cursor-pointer hover:bg-[var(--muted)]/40">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function linkFor(n: NotifItem): string | null {
  const u = n.payload.username;
  switch (n.type) {
    case "follow":
    case "follow_accepted":
      return u ? `/profil/${u}` : null;
    case "follow_request":
      return "/arkadaslar/istekler";
    case "invite":
      return n.payload.inviteUrl ? String(n.payload.inviteUrl) : (n.payload.roomId ? `/oda/${n.payload.roomId}` : "/arkadaslar");
    case "room_join":
    case "room_request":
      return "/arkadaslar";
    case "room_join_accepted":
    case "offline_invite_accepted":
      return n.payload.inviteUrl ? String(n.payload.inviteUrl) : "/arkadaslar";
    case "room_join_request":
    case "offline_invite":
      return null;
    default:
      return null;
  }
}
