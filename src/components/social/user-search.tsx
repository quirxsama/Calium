"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Loader2, Lock, X } from "lucide-react";
import { FollowButton, type FollowStatus } from "@/components/social/follow-button";

type UserResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  followStatus: FollowStatus;
};

export function UserSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (data.success) setResults(data.items ?? []);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showPanel = open && (q.trim().length >= 2 || loading);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Kullanıcı ara (@kullaniciadi veya isim)…"
          className="w-full h-11 rounded-full border border-[var(--border)] bg-[var(--card)] pl-10 pr-10 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
          aria-label="Kullanıcı ara"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults([]);
            }}
            aria-label="Temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center p-6 text-[var(--muted-foreground)]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-xs text-[var(--muted-foreground)]">Sonuç yok.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {results.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-3">
                  <Link
                    href={`/profil/${u.username}`}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)]">
                      {u.avatarUrl ? (
                        <Image
                          src={u.avatarUrl}
                          alt={u.username}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-[var(--muted-foreground)]">
                          {(u.displayName || u.username).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {u.displayName || u.username}
                        </span>
                        {u.isPrivate && <Lock className="h-3 w-3 text-[var(--muted-foreground)]" />}
                      </div>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">@{u.username}</p>
                    </div>
                  </Link>
                  <FollowButton
                    username={u.username}
                    initialStatus={u.followStatus}
                    isPrivate={u.isPrivate}
                    className="shrink-0"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
