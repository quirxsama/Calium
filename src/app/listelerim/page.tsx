"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { Plus, List, Loader2, Lock, Globe, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddAnimeSearch } from "@/components/lists/add-anime-search";

interface UserList {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  _count: { items: number; likes: number };
}

export default function MyListsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchListId, setSearchListId] = useState<string | null>(null);
  const [existingAnimeIds, setExistingAnimeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/giris");
      return;
    }
    if (user) {
      fetchLists();
    }
  }, [authLoading, user, router]);

  async function fetchLists() {
    const res = await fetch("/api/lists");
    const data = await res.json();
    if (data.success) setLists(data.lists);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, isPublic: newPublic }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.success) {
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewPublic(true);
      fetchLists();
    }
  }

  async function openSearch(listId: string) {
    setSearchListId(listId);
    try {
      const res = await fetch(`/api/lists/${listId}`);
      const data = await res.json();
      if (data.success && data.list?.items) {
        setExistingAnimeIds(
          new Set(data.list.items.map((i: { animeId: string }) => i.animeId))
        );
      } else {
        setExistingAnimeIds(new Set());
      }
    } catch {
      setExistingAnimeIds(new Set());
    }
  }

  function handleAnimeAdded(listId: string) {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, _count: { ...l._count, items: l._count.items + 1 } }
          : l
      )
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu listeyi silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Listelerim</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Yeni Liste
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Liste adı"
            required
            maxLength={100}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Açıklama (opsiyonel)"
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setNewPublic((v) => !v)}
              className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              {newPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {newPublic ? "Herkese Açık" : "Gizli"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Oluştur
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Lists */}
      {lists.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[var(--muted-foreground)]">
          <List className="h-12 w-12" />
          <p>Henüz listeniz yok.</p>
          <p className="text-sm">Yeni bir liste oluşturarak anime koleksiyonlarınızı düzenleyin.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((list) => (
            <div key={list.id} className="space-y-3">
              <div
                className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]/30 hover:shadow-lg"
              >
                <Link href={`/liste/${list.id}`} className="block">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {list.name}
                    </h3>
                    {!list.isPublic && <Lock className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />}
                  </div>
                  {list.description && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">{list.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span>{list._count.items} anime</span>
                    <span>{list._count.likes} beğeni</span>
                  </div>
                </Link>

                <div className="absolute right-3 top-3 hidden items-center gap-1 group-hover:flex">
                  <button
                    onClick={() => openSearch(list.id)}
                    className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                    aria-label="Anime ekle"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(list.id)}
                    className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Listeyi sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {searchListId === list.id && (
                <AddAnimeSearch
                  listId={list.id}
                  existingAnimeIds={existingAnimeIds}
                  onAdded={() => handleAnimeAdded(list.id)}
                  onClose={() => setSearchListId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
