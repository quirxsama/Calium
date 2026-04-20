"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { User, Calendar, List, Heart, Lock, Loader2, Users } from "lucide-react";
import { FollowButton, type FollowStatus } from "@/components/social/follow-button";
import { usePresenceSubscribe } from "@/lib/realtime/presence";
import { PresenceDot, activityText } from "@/components/social/presence-dot";

interface ProfileData {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  profilePublic: boolean;
  listsPublic?: boolean;
  isPrivate?: boolean;
  createdAt?: string;
  _count?: {
    favorites: number;
    lists: number;
    followers: number;
    following: number;
    friends: number;
  };
}

interface ListData {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  _count: { items: number; likes: number };
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [lists, setLists] = useState<ListData[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus>("not_following");
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const presence = usePresenceSubscribe(profile ? [profile.id] : []);
  const p = presence.get(profile?.id ?? "");
  const status = p?.status ?? "offline";
  const activity = activityText(p?.activity ?? null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!data.success) {
        setNotFound(true);
      } else {
        setProfile(data.user);
        setLists(data.lists ?? []);
        setIsOwner(data.isOwner ?? false);
        setFollowStatus(data.followStatus ?? "not_following");
        setRestricted(data.restricted ?? false);
      }
      setLoading(false);
    }
    load();
  }, [username]);

  function handleFollowChange(next: FollowStatus) {
    setFollowStatus(next);
    setProfile((p) => {
      if (!p || !p._count) return p;
      const delta = next === "following" ? 1 : followStatus === "following" ? -1 : 0;
      return { ...p, _count: { ...p._count, followers: Math.max(0, p._count.followers + delta) } };
    });
    // İstek kabul edilirse sayfayı yenilemek gerekir (gizli hesap içeriği için)
    if (next === "following" && profile?.isPrivate) {
      setTimeout(() => {
        fetch(`/api/users/${encodeURIComponent(username)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.success) {
              setProfile(d.user);
              setLists(d.lists ?? []);
              setRestricted(d.restricted ?? false);
            }
          });
      }, 300);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
        <User className="h-12 w-12" />
        <p className="text-lg">Kullanıcı bulunamadı</p>
      </div>
    );
  }

  const initials = (profile.displayName || profile.username).slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Profile Header */}
      <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] shadow-lg">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.username}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-[var(--muted-foreground)]">{initials}</span>
          )}
          <PresenceDot status={status} className="absolute -bottom-1 -right-1 ring-4 ring-[var(--background)]" />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2 justify-center sm:justify-start">
                {profile.displayName || profile.username}
                {profile.isPrivate && (
                  <Lock className="h-4 w-4 text-[var(--muted-foreground)]" aria-label="Gizli hesap" />
                )}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">@{profile.username}</p>
              {activity && (
                <p className="mt-1 text-xs font-semibold text-[var(--primary)] animate-in fade-in slide-in-from-top-1">
                  {activity}
                </p>
              )}
            </div>
            {!isOwner && (
              <FollowButton
                username={profile.username}
                initialStatus={followStatus}
                isPrivate={profile.isPrivate}
                onChange={handleFollowChange}
              />
            )}
          </div>

          {profile.bio && (
            <p className="mt-2 max-w-md text-sm text-[var(--foreground)]">{profile.bio}</p>
          )}

          {profile._count && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm sm:justify-start">
              <Link
                href="/arkadaslar"
                className="text-[var(--foreground)] hover:text-[var(--primary)]"
              >
                <span className="font-semibold">{profile._count.followers}</span>
                <span className="ml-1 text-[var(--muted-foreground)]">takipçi</span>
              </Link>
              <Link
                href="/arkadaslar"
                className="text-[var(--foreground)] hover:text-[var(--primary)]"
              >
                <span className="font-semibold">{profile._count.following}</span>
                <span className="ml-1 text-[var(--muted-foreground)]">takip</span>
              </Link>
              <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                <Users className="h-3.5 w-3.5" />
                {profile._count.friends} arkadaş
              </span>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted-foreground)] sm:justify-start">
            {profile.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(profile.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long" })}
              </span>
            )}
            {profile._count && (
              <>
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {profile._count.favorites} favori
                </span>
                <span className="flex items-center gap-1">
                  <List className="h-3.5 w-3.5" />
                  {profile._count.lists} liste
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Restricted (private hesap + takip etmiyorsun) veya profil gizli */}
      {restricted || (!profile.profilePublic && !isOwner) ? (
        <div className="flex flex-col items-center gap-2 py-16 text-[var(--muted-foreground)]">
          <Lock className="h-10 w-10" />
          <p>{profile.isPrivate ? "Gizli hesap — içeriği görmek için takip et." : "Bu profil gizli."}</p>
        </div>
      ) : (
        <>
          {/* Lists */}
          {lists.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Listeler</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {lists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/liste/${list.id}`}
                    className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]/30 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">
                          {list.name}
                        </h3>
                        {list.description && (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">
                            {list.description}
                          </p>
                        )}
                      </div>
                      {!list.isPublic && <Lock className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      <span>{list._count.items} anime</span>
                      <span>{list._count.likes} beğeni</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {lists.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Henüz liste oluşturulmamış.
            </p>
          )}
        </>
      )}
    </div>
  );
}
