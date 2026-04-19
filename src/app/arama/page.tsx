"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AnimeGrid, AnimeGridSkeleton } from "@/components/anime/anime-grid";
import type { AnimeData } from "@/lib/anizium/schemas";

export default function AramaPageWrapper() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><AnimeGridSkeleton /></div>}>
      <AramaPage />
    </Suspense>
  );
}

function AramaPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = sp.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<AnimeData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setItems(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/anizium/search?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error ?? "Arama başarısız.");
          setItems([]);
        } else {
          setItems(json.page?.data ?? []);
        }
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== "AbortError") {
          setError("Arama sırasında bir hata oluştu.");
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    router.replace(`/arama?${next.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Arama</h1>
      </header>
      <form onSubmit={onSubmit} className="mb-8">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Anime adı yazın…"
            className="w-full h-12 rounded-full border border-[var(--border)] bg-[var(--card)] pl-11 pr-5 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>
      </form>

      {loading && <AnimeGridSkeleton count={12} />}
      {!loading && error && (
        <div className="py-20 text-center text-[var(--muted-foreground)]">
          {error}
        </div>
      )}
      {!loading && !error && items && <AnimeGrid items={items} />}
      {!loading && items === null && !q && (
        <p className="text-[var(--muted-foreground)]">
          Aramak için bir şey yazın.
        </p>
      )}
    </div>
  );
}
