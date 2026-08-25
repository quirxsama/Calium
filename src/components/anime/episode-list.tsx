"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AniziumImage } from "./anizium-image";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Play,
  Search,
  X,
} from "lucide-react";
import type { EpisodeData } from "@/lib/anizium/schemas";
import type { UpcomingEpisodePlaceholder } from "@/lib/anizium/calendar";
import { cn } from "@/lib/utils";
import { FillerBadge } from "./filler-badge";

const PAGE_SIZE = 50;

type SortDir = "asc" | "desc";
type Variant = "grid" | "sidebar";

type Props = {
  animeId: string;
  episodes: EpisodeData[];
  activeEpisodeId?: string;
  variant?: Variant;
  upcomingEpisode?: UpcomingEpisodePlaceholder | null;
};

type EpisodeListItem =
  | { kind: "episode"; ep: EpisodeData }
  | { kind: "upcoming"; upcoming: UpcomingEpisodePlaceholder };

function epNum(e: EpisodeData): number {
  const n = typeof e.number === "number" ? e.number : Number(e.number);
  return Number.isFinite(n) ? n : 0;
}

function upcomingEpNum(e: UpcomingEpisodePlaceholder): number {
  const n = typeof e.number === "number" ? e.number : Number(e.number);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function itemNum(item: EpisodeListItem): number {
  return item.kind === "episode" ? epNum(item.ep) : upcomingEpNum(item.upcoming);
}

export function EpisodeList({
  animeId,
  episodes,
  activeEpisodeId,
  variant = "grid",
  upcomingEpisode = null,
}: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortDir>("asc");
  const activeRowRef = useRef<HTMLLIElement | null>(null);

  // Arama ve sıralama uygula
  const filtered = useMemo<EpisodeListItem[]>(() => {
    const q = query.trim().toLowerCase();
    const episodeItems = (q
      ? episodes
          .filter((e) => {
            const n = String(e.number ?? "").toLowerCase();
            return e.name.toLowerCase().includes(q) || n.includes(q);
          })
      : episodes.slice()
    ).map((ep) => ({ kind: "episode" as const, ep }));

    const upcomingItems: EpisodeListItem[] = upcomingEpisode
      ? [{ kind: "upcoming", upcoming: upcomingEpisode }]
      : [];
    const list = q
      ? [
          ...episodeItems,
          ...upcomingItems.filter((item) => {
            if (item.kind !== "upcoming") return false;
            const { upcoming } = item;
            const n = String(upcoming.number ?? "").toLowerCase();
            return n.includes(q) || upcoming.releaseText.toLowerCase().includes(q);
          }),
        ]
      : [...episodeItems, ...upcomingItems];

    list.sort((a, b) => {
      const d = itemNum(a) - itemNum(b);
      return sort === "asc" ? d : -d;
    });
    return list;
  }, [episodes, query, sort, upcomingEpisode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // İlk yüklemede aktif bölüm varsa doğrudan o bölümün bulunduğu blok sayfasından başla
  const [page, setPage] = useState(() => {
    if (!activeEpisodeId || episodes.length === 0) return 1;
    const sorted = [...episodes].sort((a, b) => epNum(a) - epNum(b));
    const idx = sorted.findIndex((e) => e.ID === activeEpisodeId);
    return idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : 1;
  });

  const [prevActiveEp, setPrevActiveEp] = useState(activeEpisodeId);
  const [prevEpisodes, setPrevEpisodes] = useState(episodes);

  // activeEpisodeId veya episodes değiştiğinde sayfayı senkronize et
  if (activeEpisodeId !== prevActiveEp || episodes !== prevEpisodes) {
    setPrevActiveEp(activeEpisodeId);
    setPrevEpisodes(episodes);
    if (activeEpisodeId) {
      const idx = filtered.findIndex((item) => item.kind === "episode" && item.ep.ID === activeEpisodeId);
      if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
    }
  }

  const safePage = Math.min(Math.max(1, page), totalPages);

  // Aktif bölüme otomatik kaydır
  useEffect(() => {
    if (!activeEpisodeId) return;
    const timer = setTimeout(() => {
      if (activeRowRef.current) {
        activeRowRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [activeEpisodeId, safePage]);

  function onQueryChange(v: string) {
    setQuery(v);
    setPage(1);
  }
  function toggleSort() {
    setSort((s) => (s === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const showPager = filtered.length > PAGE_SIZE;
  const compact = variant === "sidebar";

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          compact ? "flex-col items-stretch" : ""
        )}
      >
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Bölüm ara (isim veya numara)…"
            className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pl-9 pr-9 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className={cn("flex items-center gap-2", compact && "justify-between")}>
          <button
            onClick={toggleSort}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 h-9 text-xs font-medium hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition"
            aria-label="Sıralamayı değiştir"
            title={sort === "asc" ? "Eskiden yeniye" : "Yeniden eskiye"}
          >
            {sort === "asc" ? (
              <ArrowDownAZ className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpAZ className="h-3.5 w-3.5" />
            )}
            {sort === "asc" ? "Eski → Yeni" : "Yeni → Eski"}
          </button>

          {!compact && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {filtered.length} bölüm
            </span>
          )}
        </div>
      </div>

      {/* Page-range chips (50'şer) + üst pager kontrolü */}
      {showPager && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            aria-label="Önceki sayfa"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)] disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted-foreground)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <RangeChips
              total={filtered.length}
              page={safePage}
              totalPages={totalPages}
              sort={sort}
              onPage={setPage}
              compact={compact}
            />
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            aria-label="Sonraki sayfa"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)] disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted-foreground)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* List */}
      {pageItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)]/40 py-8 text-center text-sm text-[var(--muted-foreground)]">
          Eşleşen bölüm bulunamadı.
        </div>
      ) : compact ? (
        <ul className="space-y-2">
          {pageItems.map((ep) => (
            ep.kind === "episode" ? (
              <EpisodeRow
                key={ep.ep.ID}
                animeId={animeId}
                ep={ep.ep}
                active={ep.ep.ID === activeEpisodeId}
                compact
                rowRef={ep.ep.ID === activeEpisodeId ? activeRowRef : undefined}
              />
            ) : (
              <UpcomingEpisodeRow key={ep.upcoming.id} upcoming={ep.upcoming} compact />
            )
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pageItems.map((ep) => (
            ep.kind === "episode" ? (
              <EpisodeRow
                key={ep.ep.ID}
                animeId={animeId}
                ep={ep.ep}
                active={ep.ep.ID === activeEpisodeId}
                rowRef={ep.ep.ID === activeEpisodeId ? activeRowRef : undefined}
              />
            ) : (
              <UpcomingEpisodeRow key={ep.upcoming.id} upcoming={ep.upcoming} />
            )
          ))}
        </ul>
      )}

      {/* Bottom pager */}
      {showPager && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 h-8 text-xs disabled:opacity-40 hover:bg-[var(--muted)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Önceki
          </button>
          <span className="text-xs text-[var(--muted-foreground)]">
            Sayfa {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 h-8 text-xs disabled:opacity-40 hover:bg-[var(--muted)]"
          >
            Sonraki <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function UpcomingEpisodeRow({
  upcoming,
  compact,
}: {
  upcoming: UpcomingEpisodePlaceholder;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <li>
        <div className="flex cursor-not-allowed gap-2 rounded-lg border border-dashed border-[var(--primary)]/40 bg-[var(--primary)]/5 p-2 text-sm opacity-90">
          <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-[var(--muted)]">
            {upcoming.image && (
              <AniziumImage src={upcoming.image} alt="Yaklaşan bölüm" fill sizes="96px" className="object-cover opacity-70" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-semibold text-white">
              Yakında
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[var(--muted-foreground)]">Yaklaşan bölüm</p>
            <p className="line-clamp-2 text-xs font-medium">Bölüm {upcoming.number ?? "-"}</p>
            <p className="mt-1 text-[11px] text-[var(--primary)]">{upcoming.releaseText}</p>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div className="group flex cursor-not-allowed gap-3 rounded-xl border border-dashed border-[var(--primary)]/40 bg-[var(--primary)]/5 p-2 opacity-90">
        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
          {upcoming.image && (
            <AniziumImage src={upcoming.image} alt="Yaklaşan bölüm" fill sizes="144px" className="object-cover opacity-70" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white">
            Yakında
          </div>
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="text-xs text-[var(--muted-foreground)]">Yaklaşan bölüm</p>
          <h4 className="text-sm font-semibold line-clamp-1">Bölüm {upcoming.number ?? "-"}</h4>
          <p className="mt-1 text-xs text-[var(--primary)]">{upcoming.releaseText}</p>
        </div>
      </div>
    </li>
  );
}

function EpisodeRow({
  animeId,
  ep,
  active,
  compact,
  rowRef,
}: {
  animeId: string;
  ep: EpisodeData;
  active?: boolean;
  compact?: boolean;
  rowRef?: React.Ref<HTMLLIElement>;
}) {
  const href = `/izle/${encodeURIComponent(animeId)}/${encodeURIComponent(ep.ID)}`;
  if (compact) {
    return (
      <li ref={rowRef}>
        <Link
          href={href}
          className={cn(
            "flex gap-2 rounded-lg border p-2 text-sm transition",
            active
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
          )}
        >
          <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-[var(--muted)]">
            {ep.banner_link && (
              <AniziumImage
                src={ep.banner_link}
                alt={ep.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            )}
            {active && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Play className="h-4 w-4 fill-white text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Bölüm {ep.number ?? "-"}
              </p>
              {ep.filler && <FillerBadge />}
            </div>
            <p className="line-clamp-2 text-xs font-medium">{ep.name}</p>
          </div>
        </Link>
      </li>
    );
  }
  return (
    <li ref={rowRef}>
      <Link
        href={href}
        className={cn(
          "group flex gap-3 rounded-xl border bg-[var(--card)] p-2 transition",
          active
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--muted)]"
        )}
      >
        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
          {ep.banner_link && (
            <AniziumImage
              src={ep.banner_link}
              alt={ep.name}
              fill
              sizes="144px"
              className="object-cover transition group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs text-[var(--muted-foreground)]">
              Bölüm {ep.number ?? "-"}
            </p>
            {ep.filler && <FillerBadge />}
          </div>
          <h4 className="text-sm font-semibold line-clamp-1">{ep.name}</h4>
          {ep.overview && (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
              {ep.overview}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

function RangeChips({
  total,
  page,
  totalPages,
  sort,
  onPage,
  compact,
}: {
  total: number;
  page: number;
  totalPages: number;
  sort: SortDir;
  onPage: (p: number) => void;
  compact: boolean;
}) {
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  // Bölüm aralığı etiketi: ör. "1-50", "51-100"
  const chips = useMemo(() => {
    const arr = Array.from({ length: totalPages }, (_, i) => {
      const p = i + 1;
      const from = (p - 1) * PAGE_SIZE + 1;
      const to = Math.min(total, p * PAGE_SIZE);
      return { p, label: `${from}-${to}` };
    });
    return sort === "asc" ? arr : arr.slice().reverse();
  }, [totalPages, total, sort]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeChipRef.current) {
        activeChipRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [page]);

  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1",
        compact ? "snap-x" : "flex-wrap"
      )}
    >
      {chips.map((c) => {
        const active = c.p === page;
        return (
          <button
            key={c.p}
            ref={active ? activeChipRef : null}
            onClick={() => onPage(c.p)}
            className={cn(
              "snap-start shrink-0 rounded-full border px-3 h-7 text-xs font-medium transition",
              active
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/50"
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
