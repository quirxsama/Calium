"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/context";
import { Heart, Loader2, Lock, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListItemData {
  id: string;
  animeId: string;
  name: string;
  poster: string | null;
}

interface ListDetail {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  user: { username: string; displayName: string | null; avatarUrl: string | null };
  items: ListItemData[];
  _count: { likes: number };
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [list, setList] = useState<ListDetail | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/lists/${id}`);
      const data = await res.json();
      if (data.success) {
        setList(data.list);
        setIsOwner(data.isOwner);
        setLiked(data.liked);
      } else {
        setError(data.error ?? "Liste bulunamadı.");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function toggleLike() {
    if (!user) return;
    const method = liked ? "DELETE" : "POST";
    const res = await fetch(`/api/lists/${id}/like`, { method });
    const data = await res.json();
    if (data.success !== undefined) {
      setLiked(data.liked);
      if (list) {
        setList({
          ...list,
          _count: {
            ...list._count,
            likes: list._count.likes + (data.liked ? 1 : -1),
          },
        });
      }
    }
  }

  async function removeItem(animeId: string) {
    await fetch(`/api/lists/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId }),
    });
    if (list) {
      setList({ ...list, items: list.items.filter((i) => i.animeId !== animeId) });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
        <Lock className="h-12 w-12" />
        <p>{error || "Liste bulunamadı."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={isOwner ? "/listelerim" : `/profil/${list.user.username}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Geri
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{list.name}</h1>
            {!list.isPublic && <Lock className="h-4 w-4 text-[var(--muted-foreground)]" />}
          </div>
          {list.description && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{list.description}</p>
          )}
          <Link
            href={`/profil/${list.user.username}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
          >
            @{list.user.username}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user && !isOwner && (
            <button
              onClick={toggleLike}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm transition",
                liked
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              {list._count.likes}
            </button>
          )}
          {!user && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
              <Heart className="h-4 w-4" />
              {list._count.likes}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      {list.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--muted-foreground)]">Bu liste henüz boş.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {list.items.map((item) => (
            <div key={item.id} className="group relative">
              <Link href={`/anime/${item.animeId}`} className="block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition hover:border-[var(--primary)]/30 hover:shadow-lg">
                {item.poster ? (
                  <Image
                    src={item.poster}
                    alt={item.name}
                    width={200}
                    height={280}
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center bg-[var(--muted)] text-[var(--muted-foreground)]">
                    ?
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-xs font-medium text-[var(--foreground)] line-clamp-2">{item.name}</p>
                </div>
              </Link>
              {isOwner && (
                <button
                  onClick={() => removeItem(item.animeId)}
                  className="absolute right-1.5 top-1.5 hidden rounded-lg bg-black/70 p-1.5 text-white transition hover:bg-red-600 group-hover:block"
                  aria-label="Listeden çıkar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
