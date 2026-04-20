"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Users, UserCheck, UserPlus, Inbox, Lock, Circle, Globe2, Hash, Send, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { usePresenceSubscribe } from "@/lib/realtime/presence";
import { PresenceDot, activityText } from "@/components/social/presence-dot";
import { UserSearch } from "@/components/social/user-search";
import { useToast } from "@/components/ui/toast";

type UserCard = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  activity?: {
    kind?: string;
    animeTitle?: string | null;
    episode?: number | null;
    roomId?: string | null;
  } | null;
};

type PublicRoom = {
  id: string;
  code: string;
  animeId: string;
  animeName: string;
  episodeName: string | null;
  poster: string | null;
  lastActiveAt: string;
  host: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  _count: { members: number };
};

type Tab = "online" | "friends" | "following" | "followers" | "public_rooms";

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "online", label: "Çevrimiçi", icon: Circle },
  { id: "friends", label: "Arkadaşlar", icon: Users },
  { id: "following", label: "Takip Ediyorum", icon: UserPlus },
  { id: "followers", label: "Takipçilerim", icon: UserCheck },
  { id: "public_rooms", label: "Public Odalar", icon: Globe2 },
];

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("friends");
  const [items, setItems] = useState<UserCard[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsCount, setRequestsCount] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [requestingUserId, setRequestingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(() => setLoading(true));
    if (tab === "public_rooms") {
      fetch("/api/rooms?mode=public", { method: "PATCH" })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setPublicRooms(d.rooms ?? []);
        })
        .finally(() => setLoading(false));
      return;
    }
    // "online" sekmesi friends listesini kullanır, presence ile filtrelenir.
    const endpoint =
      tab === "friends" || tab === "online"
        ? `/api/users/${encodeURIComponent(user.username)}/friends`
        : tab === "following"
        ? `/api/users/${encodeURIComponent(user.username)}/following`
        : `/api/users/${encodeURIComponent(user.username)}/followers`;

    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [tab, user, authLoading]);

  // Presence: arkadaş + takip edilenler için abone ol
  const presence = usePresenceSubscribe(items.map((u) => u.id));
  const onlineItems = items.filter((u) => {
    const p = presence.get(u.id);
    return p && p.status !== "offline" && p.status !== "invisible";
  });
  const visibleItems = tab === "online" ? onlineItems : items;

  async function joinByCode() {
    const code = joinCode.trim();
    if (code.length < 4) return;
    setJoinLoading(true);
    try {
      const res = await fetch("/api/rooms/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success && data.room?.id) {
        window.location.href = `/oda/${data.room.id}?code=${encodeURIComponent(data.room.code ?? code)}`;
      } else {
        toast(data.error ?? "Odaya katılamadı.", "error");
      }
    } finally {
      setJoinLoading(false);
    }
  }

  async function sendRoomRequest(targetUserId: string, roomId?: string | null, roomCode?: string | null) {
    setRequestingUserId(targetUserId);
    try {
      const res = await fetch("/api/rooms/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, roomId: roomId ?? undefined, roomCode: roomCode ?? undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error ?? "İstek gönderilemedi.", "error");
      } else {
        toast("İstek gönderildi.", "success");
      }
    } finally {
      setRequestingUserId(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    void fetch("/api/follow/requests")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRequestsCount(d.requests?.length ?? 0);
      })
      .catch(() => {});
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[var(--muted-foreground)]">
        <p>Arkadaşlarını görmek için giriş yapmalısın.</p>
        <Link
          href="/giris"
          className="mt-4 inline-block rounded-full bg-[var(--primary)] px-6 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Giriş Yap
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sosyal</h1>
        <Link
          href="/arkadaslar/istekler"
          className="relative inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm hover:border-[var(--primary)]/40"
        >
          <Inbox className="h-4 w-4" />
          İstekler
          {requestsCount > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-semibold text-[var(--primary-foreground)]">
              {requestsCount}
            </span>
          )}
        </Link>
      </div>

      <div className="mb-4">
        <UserSearch />
      </div>

      <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Kod ile odaya katıl</p>
            <p className="text-xs text-[var(--muted-foreground)]">Arkadaşının verdiği oda kodunu gir.</p>
          </div>
          <div className="flex w-full gap-2 sm:max-w-sm">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Oda kodu"
              className="h-10 flex-1 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={() => void joinByCode()}
              disabled={joinLoading}
              className="inline-flex h-10 items-center gap-1 rounded-full bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />} Katıl
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition",
                active
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : tab === "public_rooms" ? (
        publicRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-[var(--muted-foreground)]">
            <Globe2 className="h-10 w-10" />
            <p className="text-sm">Şu an açık public oda yok.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {publicRooms.map((room) => (
              <Link
                key={room.id}
                href={`/oda/${room.id}?code=${encodeURIComponent(room.code)}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{room.animeName}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">{room.episodeName || "Bölüm bilgisi yok"}</p>
                  </div>
                  <span className="rounded-full bg-[var(--primary)]/10 px-2 py-1 text-[11px] text-[var(--primary)]">{room._count.members} kişi</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>@{room.host.username}</span>
                  <span>Kod: {room.code}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-[var(--muted-foreground)]">
          <Users className="h-10 w-10" />
          <p className="text-sm">
            {tab === "online"
              ? "Şu an çevrimiçi arkadaş yok."
              : tab === "friends"
              ? "Henüz karşılıklı takipleştiğin kimse yok."
              : tab === "following"
              ? "Henüz kimseyi takip etmiyorsun."
              : "Henüz takipçin yok."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleItems.map((u) => {
            const initials = (u.displayName || u.username).slice(0, 2).toUpperCase();
            const p = presence.get(u.id);
            const status = p?.status ?? "offline";
            const activity = activityText(p?.activity ?? null);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:border-[var(--primary)]/40"
              >
                <Link
                  href={`/profil/${u.username}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)]">
                    {u.avatarUrl ? (
                      <Image
                        src={u.avatarUrl}
                        alt={u.username}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-[var(--muted-foreground)]">{initials}</span>
                    )}
                    <PresenceDot
                      status={status}
                      className="absolute -bottom-0.5 -right-0.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{u.displayName || u.username}</span>
                      {u.isPrivate && <Lock className="h-3 w-3 text-[var(--muted-foreground)]" />}
                    </div>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {activity ? (
                        <span className="text-[var(--primary)]">{activity}</span>
                      ) : (
                        <>@{u.username}</>
                      )}
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {p?.activity?.roomId && (
                    <>
                      <Link
                        href={`/oda/${p.activity.roomId}`}
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs hover:bg-[var(--muted)]"
                      >
                        <DoorOpen className="h-3.5 w-3.5" /> Odaya Katıl
                      </Link>
                      {status !== "dnd" && (
                        <button
                          type="button"
                          onClick={() => void sendRoomRequest(u.id, p.activity?.roomId ?? null, null)}
                          disabled={requestingUserId === u.id}
                          className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 text-xs text-[var(--primary)] disabled:opacity-60"
                        >
                          {requestingUserId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} İstek Gönder
                        </button>
                      )}
                    </>
                  )}
                </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
