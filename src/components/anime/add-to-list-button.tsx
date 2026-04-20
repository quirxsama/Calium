"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { ListPlus, Loader2, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListInfo {
  id: string;
  name: string;
  items?: { animeId: string }[];
}

type Props = {
  animeId: string;
  animeName: string;
  poster?: string | null;
};

export function AddToListButton({ animeId, animeName, poster }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen() {
    if (!user) return;
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      try {
        const res = await fetch("/api/lists");
        const data = await res.json();
        if (data.success) {
          setLists(data.lists);
          // Check which lists already contain this anime (parallel)
          const already = new Set<string>();
          await Promise.all(
            data.lists.map(async (list: ListInfo) => {
              const detailRes = await fetch(`/api/lists/${list.id}`);
              const detailData = await detailRes.json();
              if (detailData.success && detailData.list?.items) {
                const found = detailData.list.items.some(
                  (item: { animeId: string }) => item.animeId === animeId
                );
                if (found) already.add(list.id);
              }
            })
          );
          setAddedTo(already);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
  }

  async function addToList(listId: string) {
    setAdding(listId);
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId, name: animeName, poster: poster ?? null }),
      });
      const data = await res.json();
      if (data.success) {
        setAddedTo((prev) => new Set(prev).add(listId));
      }
    } catch { /* ignore */ }
    setAdding(null);
  }

  async function removeFromList(listId: string) {
    setAdding(listId);
    try {
      await fetch(`/api/lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId }),
      });
      setAddedTo((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    } catch { /* ignore */ }
    setAdding(null);
  }

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--muted)]"
        aria-label="Listeye ekle"
      >
        <ListPlus className="h-4 w-4" />
        Listeye Ekle
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--foreground)]">Listeye Ekle</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : lists.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-[var(--muted-foreground)]">
              <p>Henüz listeniz yok.</p>
              <a href="/listelerim" className="mt-1 inline-block text-[var(--primary)] hover:underline">
                Liste oluştur
              </a>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto py-1">
              {lists.map((list) => {
                const isAdded = addedTo.has(list.id);
                const isLoading = adding === list.id;
                return (
                  <button
                    key={list.id}
                    onClick={() => (isAdded ? removeFromList(list.id) : addToList(list.id))}
                    disabled={isLoading}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition",
                      isAdded
                        ? "text-[var(--primary)] hover:bg-[var(--primary)]/5"
                        : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : isAdded ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                    )}
                    <span className="truncate">{list.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
