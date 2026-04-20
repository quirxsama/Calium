"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimePlayer } from "./anime-player";
import type {
  AnimeDetails,
  EpisodeData,
  SourceContent,
  SourceGroup,
  SubtitleData,
} from "@/lib/anizium/schemas";
import { upsertHistory, getHistoryEntry } from "@/lib/storage/history";
import { ArrowLeft, SkipForward, SkipBack } from "lucide-react";
import { formatDuration, parseTimeCode } from "@/lib/utils";
import { EpisodeList } from "@/components/anime/episode-list";

type Props = {
  details: AnimeDetails;
  episodeId: string;
};

type SourcesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      groups: SourceGroup[];
      subtitles: SubtitleData[];
      content: SourceContent | null;
    };

export function WatchPageClient({ details, episodeId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SourcesState>({ status: "loading" });
  const [startAt, setStartAt] = useState<number>(0);

  const isMovie = episodeId === "film";

  const { currentSeason, currentEp, nextEp, prevEp } = useMemo(() => {
    let curSeason = null as (typeof details.seasons)[number] | null;
    let curEp = null as EpisodeData | null;
    let nxt = null as { seasonId: string; ep: EpisodeData } | null;
    let prv = null as { seasonId: string; ep: EpisodeData } | null;
    const seasons = details.seasons ?? [];

    // Film: sezon verisi yoksa sanal sezon/bölüm oluştur
    if (isMovie && seasons.length === 0) {
      return {
        currentSeason: { ID: "film", name: details.name, number: 1, episodes: [] as EpisodeData[] },
        currentEp: { ID: "film", name: details.name, number: 1, overview: details.overview ?? null, banner_link: null } as EpisodeData,
        nextEp: null,
        prevEp: null,
      };
    }

    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i];
      const idx = s.episodes.findIndex((e) => e.ID === episodeId);
      if (idx >= 0) {
        curSeason = s;
        curEp = s.episodes[idx];
        if (idx + 1 < s.episodes.length) {
          nxt = { seasonId: s.ID, ep: s.episodes[idx + 1] };
        } else if (i + 1 < seasons.length && seasons[i + 1].episodes.length) {
          nxt = { seasonId: seasons[i + 1].ID, ep: seasons[i + 1].episodes[0] };
        }
        if (idx - 1 >= 0) {
          prv = { seasonId: s.ID, ep: s.episodes[idx - 1] };
        } else if (i - 1 >= 0 && seasons[i - 1].episodes.length) {
          prv = { seasonId: seasons[i - 1].ID, ep: seasons[i - 1].episodes[seasons[i - 1].episodes.length - 1] };
        }
        break;
      }
    }
    return { currentSeason: curSeason, currentEp: curEp, nextEp: nxt, prevEp: prv };
  }, [details, episodeId, isMovie]);

  useEffect(() => {
    const h = getHistoryEntry(details.ID);
    if (h) setStartAt(h.progress);
  }, [details.ID]);

  useEffect(() => {
    setState({ status: "loading" });
    const ctrl = new AbortController();
    (async () => {
      const rawSeason = currentSeason?.number;
      const rawEp = currentEp?.number;
      const seasonNum = rawSeason != null ? Number(rawSeason) : NaN;
      const epNum = rawEp != null ? Number(rawEp) : NaN;
      if (!Number.isFinite(seasonNum) || !Number.isFinite(epNum)) {
        setState({
          status: "error",
          message: "Bölüm numarası bulunamadı.",
        });
        return;
      }
      try {
        const res = await fetch(
          `/api/anizium/episode?animeId=${encodeURIComponent(details.ID)}&season=${seasonNum}&episode=${epNum}`,
          { signal: ctrl.signal, cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok || json.success === false) {
          setState({
            status: "error",
            message:
              json.error ??
              "Video kaynağı bulunamadı. API endpoint yapısı doğrulanmamış olabilir.",
          });
          return;
        }
        const groups: SourceGroup[] = (json.groups ?? []).filter(
          (g: SourceGroup) => g.items && g.items.length > 0
        );
        setState({
          status: "ready",
          groups,
          subtitles: json.subtitles ?? [],
          content: json.content ?? null,
        });
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setState({
          status: "error",
          message: (e as Error).message ?? "Beklenmeyen hata",
        });
      }
    })();
    return () => ctrl.abort();
  }, [episodeId]);

  const lastSaveRef = useRef(0);
  function onTU(current: number, duration: number) {
    if (!currentEp || duration <= 0) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 4000) return;
    lastSaveRef.current = now;
    upsertHistory({
      animeId: details.ID,
      animeName: details.name,
      poster: details.poster ?? details.details_banner ?? null,
      episodeId: currentEp.ID,
      episodeName: currentEp.name,
      episodeNumber:
        typeof currentEp.number === "number"
          ? currentEp.number
          : currentEp.number
          ? Number(currentEp.number)
          : null,
      seasonNumber:
        typeof currentSeason?.number === "number"
          ? currentSeason.number
          : currentSeason?.number
          ? Number(currentSeason.number)
          : null,
      progress: current,
      duration,
      updatedAt: now,
    });
  }

  function onEnded() {
    if (nextEp) {
      router.push(
        `/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(nextEp.ep.ID)}`
      );
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/anime/${encodeURIComponent(details.ID)}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" /> {details.name}
        </Link>
        <div className="flex items-center gap-2">
          {prevEp && (
            <Link
              href={`/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(prevEp.ep.ID)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
            >
              <SkipBack className="h-3.5 w-3.5" /> Önceki Bölüm
            </Link>
          )}
          {nextEp && (
            <Link
              href={`/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(nextEp.ep.ID)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
            >
              Sonraki Bölüm <SkipForward className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          {state.status === "loading" && (
            <div className="aspect-video w-full rounded-xl bg-[var(--muted)] skeleton" />
          )}
          {state.status === "error" && (
            <div className="aspect-video w-full rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-center text-center p-6">
              <div>
                <p className="text-[var(--foreground)] font-semibold">
                  Video kaynağı yüklenemedi
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)] max-w-md">
                  {state.message}
                </p>
              </div>
            </div>
          )}
          {state.status === "ready" && (
            <AnimePlayer
              groups={state.groups}
              subtitles={state.subtitles}
              poster={currentEp?.banner_link ?? details.details_banner ?? null}
              title={`${details.name} — ${currentEp?.name ?? ""}`}
              startAt={startAt}
              onTimeUpdate={onTU}
              onEnded={onEnded}
              introStart={parseTimeCode(state.content?.opening?.start)}
              introEnd={parseTimeCode(state.content?.opening?.end)}
              outroStart={parseTimeCode(state.content?.next_episode)}
              nextEpisodeHref={nextEp ? `/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(nextEp.ep.ID)}` : null}
            />
          )}

          <div className="mt-4">
            <h1 className="text-2xl font-bold">
              {currentEp?.name ?? "Bölüm"}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {currentSeason?.name}
              {currentEp?.number ? ` · Bölüm ${currentEp.number}` : ""}
              {startAt > 5 && state.status === "ready" && (
                <span className="ml-2 inline-block rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[11px] text-[var(--primary)]">
                  {formatDuration(startAt)}'den devam ediyor
                </span>
              )}
            </p>
            {currentEp?.overview && (
              <p className="mt-3 text-sm text-[var(--muted-foreground)] max-w-3xl leading-relaxed">
                {currentEp.overview}
              </p>
            )}
          </div>
        </div>

        {/* Episode list sidebar */}
        <aside className="lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar">
          <h3 className="mb-3 text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            {currentSeason?.name ?? "Bölümler"}
          </h3>
          <EpisodeList
            animeId={details.ID}
            episodes={currentSeason?.episodes ?? []}
            activeEpisodeId={episodeId}
            variant="sidebar"
          />
        </aside>
      </div>
    </div>
  );
}
