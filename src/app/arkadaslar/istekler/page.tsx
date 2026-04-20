"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Check, X, ArrowLeft } from "lucide-react";

type RequestItem = {
  id: string;
  createdAt: string;
  requester: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export default function FollowRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/follow/requests");
    const data = await res.json();
    if (data.success) setItems(data.requests ?? []);
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  async function act(username: string, action: "accept" | "decline") {
    setBusy(username);
    await fetch(`/api/follow/requests/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setItems((list) => list.filter((i) => i.requester.username !== username));
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/arkadaslar"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" /> Geri
        </Link>
      </div>
      <h1 className="mb-4 text-2xl font-bold">Takip İstekleri</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">
          Bekleyen isteğin yok.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const u = it.requester;
            const initials = (u.displayName || u.username).slice(0, 2).toUpperCase();
            const pending = busy === u.username;
            return (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <Link
                  href={`/profil/${u.username}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)]">
                    {u.avatarUrl ? (
                      <Image
                        src={u.avatarUrl}
                        alt={u.username}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-[var(--muted-foreground)]">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.displayName || u.username}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      @{u.username}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => act(u.username, "accept")}
                  disabled={pending}
                  aria-label="Kabul et"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => act(u.username, "decline")}
                  disabled={pending}
                  aria-label="Reddet"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
