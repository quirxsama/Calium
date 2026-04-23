"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Search } from "lucide-react";
import { GENRES } from "@/lib/anizium/constants";

export function GenreDropdown({ activeGenreId }: { activeGenreId?: string }) {
  const [query, setQuery] = useState("");

  const filteredGenres = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return GENRES;

    return GENRES.filter((genre) =>
      genre.name.toLocaleLowerCase("tr-TR").includes(normalized)
    );
  }, [query]);

  const activeGenre = GENRES.find((genre) => genre.id === activeGenreId);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-sm transition hover:bg-[var(--muted)]"
        >
          <span>{activeGenre ? activeGenre.name : "Tür seç"}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="start"
          className="z-50 w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl"
        >
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tür ara..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto pr-1">
            <div className="grid gap-1">
              {filteredGenres.map((genre) => (
                <DropdownMenu.Item key={genre.id} asChild>
                  <Link
                    href={`/kesfet?kind=genre&id=${genre.id}`}
                    className={`rounded-xl px-3 py-2 text-sm outline-none transition ${
                      activeGenreId === genre.id
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "hover:bg-[var(--muted)]"
                    }`}
                  >
                    {genre.name}
                  </Link>
                </DropdownMenu.Item>
              ))}

              {filteredGenres.length === 0 && (
                <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  Sonuç bulunamadı.
                </div>
              )}
            </div>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
