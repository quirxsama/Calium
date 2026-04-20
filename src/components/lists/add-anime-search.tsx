"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Search, Plus, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimeResult {
  ID: string;
  name: string;
  poster?: string | null;
}

interface Props {
  listId: string;
  existingAnimeIds: Set<string>;
  onAdded: (anime: { animeId: string; name: string; poster: string | null }) => void;
  onClose: () => void;
}

export function AddAnimeSearch({ listId, existingAnimeIds, onAdded, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set(existingAnimeIds));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/anizium/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.page?.data) {
          setResults(data.page.data);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleAdd(anime: AnimeResult) {
    setAdding(anime.ID);
    try {
      const res = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId: anime.ID,
          name: anime.name,
          poster: anime.poster ?? null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddedIds((prev) => new Set(prev).add(anime.ID));
        onAdded({ animeId: anime.ID, name: anime.name, poster: anime.poster ?? null });
      }
    } catch { /* ignore */ }
    setAdding(null);
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Anime ara…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />}
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Results */}
      <div className="max-h-80 overflow-y-auto">
        {query.trim().length >= 2 && results.length === 0 && !searching && (
          <p className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
            Sonuç bulunamadı.
          </p>
        )}

        {results.map((anime) => {
          const isAdded = addedIds.has(anime.ID);
          const isLoading = adding === anime.ID;
          return (
            <div
              key={anime.ID}
              className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-0"
            >
              {/* Poster thumbnail */}
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-[var(--muted)]">
                {anime.poster ? (
                  <Image
                    src={anime.poster}
                    alt={anime.name}
                    width={36}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted-foreground)]">
                    ?
                  </div>
                )}
              </div>

              {/* Name */}
              <p className="flex-1 truncate text-sm text-[var(--foreground)]">{anime.name}</p>

              {/* Add button */}
              <button
                onClick={() => handleAdd(anime)}
                disabled={isAdded || isLoading}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                  isAdded
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                aria-label={isAdded ? "Eklendi" : "Ekle"}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isAdded ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
