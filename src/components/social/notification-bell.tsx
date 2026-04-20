"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

type NotifItem = {
  id: string;
  type: string;
  payload: {
    actorId?: string;
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
    refresh();
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
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Check className="h-3 w-3" /> Tümünü okundu işaretle
              </button>
            )}
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
                  const body = (
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0 rounded-full",
                          n.readAt ? "bg-transparent" : "bg-[var(--primary)]"
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
                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link href={href} onClick={() => setOpen(false)} className="block hover:bg-[var(--muted)]/40">
                          {body}
                        </Link>
                      ) : (
                        body
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
    case "room_join":
      // İleride oda id varsa oraya link. Şimdilik arkadaşlar sekmesi.
      return "/arkadaslar";
    default:
      return null;
  }
}
