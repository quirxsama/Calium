"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronDown, Check, Loader2, PlayCircle, Clock, CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

interface Props {
  animeId: string;
  animeName: string;
  poster?: string | null;
  totalEpisodes?: number | null;
}

const STATUS_CONFIG = {
  watching: { label: "Devam Ediyor", icon: PlayCircle, color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  plan_to_watch: { label: "Planlandı", icon: Clock, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  completed: { label: "Bitirildi", icon: CheckCircle2, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  dropped: { label: "Yarıda Bırakıldı", icon: XCircle, color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
  on_hold: { label: "Beklemede", icon: PauseCircle, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

export function LibraryStatusButton({ animeId, animeName, poster, totalEpisodes }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [entry, setEntry] = useState<{ id: string; version: number; status: StatusKey } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function checkStatus() {
      try {
        const res = await fetch("/api/tracking/entries");
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !Array.isArray(data.entries)) return;
        const match = data.entries.find(
          (e: { sourceId?: string; title?: string }) =>
            (e.sourceId && e.sourceId === animeId) ||
            (e.title && e.title.toLowerCase() === animeName.toLowerCase())
        );
        if (match) {
          setEntry({ id: match.id, version: match.version, status: match.value.status as StatusKey });
        } else {
          setEntry(null);
        }
      } catch {}
    }

    checkStatus();
    const onLibraryChange = () => checkStatus();
    window.addEventListener("calium:library-changed", onLibraryChange);
    return () => {
      active = false;
      window.removeEventListener("calium:library-changed", onLibraryChange);
    };
  }, [user, animeId, animeName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function updateStatus(status: StatusKey) {
    if (!user) {
      router.push("/giris");
      return;
    }
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch("/api/tracking/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry?.id,
          version: entry?.version,
          sourceId: animeId,
          title: animeName,
          totalEpisodes: totalEpisodes ?? null,
          confirmMapping: true,
          value: { status, poster: poster ?? undefined },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntry({ id: data.entry.id, version: data.entry.version, status });
        window.dispatchEvent(new CustomEvent("calium:library-changed"));
      } else if (res.status === 409) {
        const refresh = await fetch("/api/tracking/entries");
        if (refresh.ok) {
          const freshData = await refresh.json();
          const match = Array.isArray(freshData.entries)
            ? freshData.entries.find((e: { sourceId?: string; title?: string }) => (e.sourceId && e.sourceId === animeId) || (e.title && e.title.toLowerCase() === animeName.toLowerCase()))
            : null;
          if (match) {
            const retryRes = await fetch("/api/tracking/entries", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: match.id,
                version: match.version,
                sourceId: animeId,
                title: animeName,
                totalEpisodes: totalEpisodes ?? null,
                confirmMapping: true,
                value: { status, poster: poster ?? undefined },
              }),
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              setEntry({ id: retryData.entry.id, version: retryData.entry.version, status });
              window.dispatchEvent(new CustomEvent("calium:library-changed"));
            }
          }
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function removeFromLibrary() {
    if (!entry) return;
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch("/api/tracking/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, version: entry.version }),
      });
      if (res.ok) {
        setEntry(null);
        window.dispatchEvent(new CustomEvent("calium:library-changed"));
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  const currentConfig = entry?.status ? STATUS_CONFIG[entry.status] : null;

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
          currentConfig
            ? currentConfig.color
            : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)]"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentConfig ? (
          <currentConfig.icon className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        <span>{currentConfig ? currentConfig.label : "Kütüphaneye Ekle"}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl shadow-black/40 z-50 animate-in fade-in zoom-in-95 duration-150">
          {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((key) => {
            const item = STATUS_CONFIG[key];
            const isSelected = entry?.status === key;
            const Icon = item.icon;
            return (
              <button
                key={key}
                onClick={() => updateStatus(key)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                  isSelected
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
              </button>
            );
          })}

          {entry && (
            <>
              <div className="my-1 h-px bg-[var(--border)]" />
              <button
                onClick={removeFromLibrary}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Kütüphaneden Çıkar</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
