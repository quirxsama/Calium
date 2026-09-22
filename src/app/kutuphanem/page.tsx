"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  Search,
  RefreshCw,
  Plus,
  Minus,
  Play,
  Star,
  MoreVertical,
  Trash2,
  Check,
  Compass,
  Loader2,
} from "lucide-react";
import { AniziumImage } from "@/components/anime/anizium-image";

interface TrackingValue {
  status: "watching" | "completed" | "on_hold" | "dropped" | "plan_to_watch";
  progress: number;
  score: number;
  poster?: string | null;
}

interface TrackingItem {
  id: string;
  sourceId: string | null;
  malId: number | null;
  anilistId: number | null;
  title: string;
  totalEpisodes: number | null;
  value: TrackingValue;
  version: number;
}

const TABS = [
  { key: "all", label: "Tümü" },
  { key: "watching", label: "İzleniyor", badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { key: "plan_to_watch", label: "Planlandı", badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { key: "completed", label: "Bitirildi", badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { key: "dropped", label: "Bırakıldı", badgeColor: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABELS: Record<TrackingValue["status"], { label: string; color: string }> = {
  watching: { label: "İzleniyor", color: "bg-blue-500/90 text-white" },
  plan_to_watch: { label: "Planlandı", color: "bg-purple-500/90 text-white" },
  completed: { label: "Bitirildi", color: "bg-emerald-500/90 text-white" },
  dropped: { label: "Bırakıldı", color: "bg-rose-500/90 text-white" },
  on_hold: { label: "Beklemede", color: "bg-amber-500/90 text-white" },
};

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<TrackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/giris");
      return;
    }
    let active = true;
    if (user) {
      fetch("/api/tracking/entries")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!active || !data) return;
          setItems(data.entries || []);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [user, authLoading, router]);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/integrations/sync", { method: "POST" });
      await new Promise((r) => setTimeout(r, 1200));
      const res = await fetch("/api/tracking/entries");
      if (res.ok) {
        const data = await res.json();
        setItems(data.entries || []);
      }
    } catch {} finally {
      setSyncing(false);
    }
  }

  async function decrementEpisode(e: React.MouseEvent, item: TrackingItem) {
    e.preventDefault();
    e.stopPropagation();
    const current = item.value.progress ?? 0;
    if (current <= 0) return;

    const prev = current - 1;
    const total = item.totalEpisodes ?? 0;
    setItems((old) =>
      old.map((i) =>
        i.id === item.id
          ? {
              ...i,
              value: {
                ...i.value,
                progress: prev,
                status: total > 0 && prev < total && i.value.status === "completed" ? "watching" : i.value.status,
              },
            }
          : i
      )
    );

    try {
      await fetch("/api/tracking/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: item.id,
          completedEpisodes: prev,
        }),
      });
    } catch {}
  }

  async function incrementEpisode(e: React.MouseEvent, item: TrackingItem) {
    e.preventDefault();
    e.stopPropagation();
    const current = item.value.progress ?? 0;
    const total = item.totalEpisodes ?? 0;
    if (total > 0 && current >= total) return;

    const next = current + 1;
    setItems((prevItems) =>
      prevItems.map((i) =>
        i.id === item.id
          ? {
              ...i,
              value: {
                ...i.value,
                progress: next,
                status: total > 0 && next >= total ? "completed" : i.value.status === "plan_to_watch" ? "watching" : i.value.status,
              },
            }
          : i
      )
    );

    try {
      await fetch("/api/tracking/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: item.id,
          completedEpisodes: next,
        }),
      });
    } catch {}
  }

  async function changeStatus(item: TrackingItem, status: TrackingValue["status"]) {
    setMenuOpenId(null);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, value: { ...i.value, status } } : i))
    );
    try {
      await fetch("/api/tracking/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          version: item.version,
          value: { status },
        }),
      });
    } catch {}
  }

  async function removeItem(item: TrackingItem) {
    setMenuOpenId(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await fetch("/api/tracking/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
    } catch {}
  }

  const counts = useMemo(() => {
    const c = { all: items.length, watching: 0, plan_to_watch: 0, completed: 0, dropped: 0 };
    for (const item of items) {
      const s = item.value?.status;
      if (s && s in c) c[s as keyof typeof c]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (activeTab !== "all" && item.value?.status !== activeTab) return false;
      if (query.trim() && !item.title.toLowerCase().includes(query.toLowerCase().trim())) return false;
      return true;
    });
  }, [items, activeTab, query]);

  if (authLoading || (loading && user)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] md:text-4xl">
            Kütüphanem
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Kişisel anime listen ve izleme ilerlemen
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-[var(--primary)]" : ""}`} />
          <span>{syncing ? "Eşitleniyor..." : "Eşitle"}</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/25"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] ${active ? "opacity-90" : "opacity-60"}`}>
                  ({counts[tab.key]})
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Anime ara..."
            className="w-full rounded-full border border-[var(--border)] bg-[var(--card)] pl-8 pr-4 py-1.5 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]"
          />
        </div>
      </div>

      {/* Anime Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 px-6 py-16 text-center">
          <p className="text-base font-bold text-[var(--foreground)]">Henüz bir anime eklenmemiş</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
            {query
              ? "Aramana uygun anime bulunamadı."
              : "İzlediğin animeleri ekleyerek kütüphaneni oluşturabilirsin."}
          </p>
          <Link
            href="/kesfet"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            <Compass className="h-4 w-4" /> Animeleri Keşfet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item) => {
            const val = item.value;
            const progress = val.progress ?? 0;
            const total = item.totalEpisodes ?? 0;
            const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
            const statusInfo = STATUS_LABELS[val.status] ?? STATUS_LABELS.watching;
            const poster = val.poster;

            const href = item.sourceId
              ? `/anime/${encodeURIComponent(item.sourceId)}`
              : `/arama?q=${encodeURIComponent(item.title)}`;

            const isMenuOpen = menuOpenId === item.id;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--primary)]/60 hover:shadow-xl hover:shadow-[var(--primary)]/10"
              >
                {/* Poster Area */}
                <Link href={href} className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--muted)]">
                  {poster ? (
                    <AniziumImage
                      src={poster}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 200px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-[var(--muted-foreground)]">
                      {item.title}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute left-2 top-2 z-10">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold shadow-md backdrop-blur-md ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Rating Badge */}
                  {val.score > 0 && (
                    <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      {(val.score / 10).toFixed(1)}
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3 py-1 text-[11px] font-semibold text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/30">
                      <Play className="h-3 w-3 fill-current" /> İzle
                    </div>
                  </div>

                  {/* Progress Bar on Poster Bottom */}
                  {total > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50">
                      <div
                        className="h-full bg-[var(--primary)] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Link>

                {/* Card Info & Quick Actions */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                  <Link
                    href={href}
                    className="text-xs font-bold leading-snug line-clamp-2 text-[var(--foreground)] hover:text-[var(--primary)] transition"
                  >
                    {item.title}
                  </Link>

                  <div className="flex items-center justify-between pt-1 text-xs text-[var(--muted-foreground)]">
                    <span>
                      Bölüm <strong className="text-[var(--foreground)]">{progress}</strong>
                      {total > 0 ? ` / ${total}` : ""}
                    </span>

                    <div className="flex items-center gap-1 relative">
                      {/* -1 Episode Quick Decrement */}
                      <button
                        onClick={(e) => decrementEpisode(e, item)}
                        disabled={progress <= 0}
                        title="-1 Bölüm"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] transition hover:bg-[var(--primary)] hover:text-white disabled:opacity-30"
                      >
                        <Minus className="h-3 w-3" />
                      </button>

                      {/* +1 Episode Quick Increment */}
                      <button
                        onClick={(e) => incrementEpisode(e, item)}
                        disabled={total > 0 && progress >= total}
                        title="+1 Bölüm"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] transition hover:bg-[var(--primary)] hover:text-white disabled:opacity-30"
                      >
                        <Plus className="h-3 w-3" />
                      </button>

                      {/* Status Menu Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId(isMenuOpen ? null : item.id);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 bottom-8 z-30 w-36 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-100"
                        >
                          {(Object.keys(STATUS_LABELS) as TrackingValue["status"][]).map((st) => (
                            <button
                              key={st}
                              onClick={() => changeStatus(item, st)}
                              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                                val.status === st
                                  ? "bg-[var(--primary)]/10 text-[var(--primary)] font-bold"
                                  : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                              }`}
                            >
                              <span>{STATUS_LABELS[st].label}</span>
                              {val.status === st && <Check className="h-3 w-3" />}
                            </button>
                          ))}
                          <div className="my-1 h-px bg-[var(--border)]" />
                          <button
                            onClick={() => removeItem(item)}
                            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Kaldır</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
