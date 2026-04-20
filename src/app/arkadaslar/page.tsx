"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Users, UserCheck, UserPlus, Inbox, Lock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { usePresenceSubscribe } from "@/lib/realtime/presence";
import { PresenceDot, activityText } from "@/components/social/presence-dot";
import { UserSearch } from "@/components/social/user-search";

type UserCard = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
};

type Tab = "online" | "friends" | "following" | "followers";

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "online", label: "Çevrimiçi", icon: Circle },
  { id: "friends", label: "Arkadaşlar", icon: Users },
  { id: "following", label: "Takip Ediyorum", icon: UserPlus },
  { id: "followers", label: "Takipçilerim", icon: UserCheck },
];

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("friends");
  const [items, setItems] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsCount, setRequestsCount] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
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

  useEffect(() => {
    if (!user) return;
    fetch("/api/follow/requests")
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
              <Link
                key={u.id}
                href={`/profil/${u.username}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:border-[var(--primary)]/40"
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
            );
          })}
        </div>
      )}
    </div>
  );
}
