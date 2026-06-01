"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type {
  AnimeDetails,
  EpisodeData,
  SourceContent,
  SourceGroup,
  SubtitleData,
} from "@/lib/anizium/schemas";
import type { UpcomingEpisodePlaceholder } from "@/lib/anizium/calendar";
import { upsertHistory, getHistoryEntry, isEpisodeFinished } from "@/lib/storage/history";
import { usePublishActivity } from "@/lib/realtime/presence";
import { ArrowLeft, SkipForward, SkipBack, ChevronDown } from "lucide-react";
import { cn, formatDuration, parseTimeCode } from "@/lib/utils";
import { EpisodeList } from "@/components/anime/episode-list";
import { WatchTogetherButton } from "@/components/rooms/watch-together-button";
import { FillerBadge } from "@/components/anime/filler-badge";

const AnimePlayer = dynamic(() => import("./anime-player").then((m) => m.AnimePlayer), {
  ssr: false,
  loading: () => (
    <div className="aspect-video w-full rounded-xl bg-[var(--muted)] skeleton" />
  ),
});

type Props = {
  details: AnimeDetails;
  episodeId: string;
  upcomingEpisode?: UpcomingEpisodePlaceholder | null;
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

function getNextEpisode(
  details: AnimeDetails,
  episodeId: string,
  isMovie: boolean
): {
  currentSeason: AnimeDetails["seasons"][number] | null;
  currentEp: EpisodeData | null;
  nextEp: { seasonId: string; ep: EpisodeData } | null;
  prevEp: { seasonId: string; ep: EpisodeData } | null;
} {
  let curSeason = null as AnimeDetails["seasons"][number] | null;
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
}

export function WatchPageClient({ details, episodeId, upcomingEpisode = null }: Props) {
  const router = useRouter();
  const [state, setState] = useState<SourcesState>({ status: "loading" });
  const [startAt, setStartAt] = useState<number>(0);

  const isMovie = episodeId === "film";

  const { currentSeason, currentEp, nextEp, prevEp } = useMemo(() => {
    return getNextEpisode(details, episodeId, isMovie);
  }, [details, episodeId, isMovie]);

  useEffect(() => {
    // History animeId başına tek giriş tutuyor; devam süresini yalnızca
    // kaydedilen bölüm şu an açık olan bölümle aynıysa uygula. Aksi halde
    // yeni bölüm önceki bölümün progress'iyle seede ediliyordu.
    const h = getHistoryEntry(details.ID);
    queueMicrotask(() => {
      if (h && h.episodeId === episodeId) {
        setStartAt(h.progress);
      } else {
        setStartAt(0);
      }
    });
  }, [details.ID, episodeId]);

  // Real-time: şu an izlediğini takipçilerine yay
  usePublishActivity({
    kind: "watching",
    animeId: details.ID,
    animeTitle: details.name,
    episode:
      typeof currentEp?.number === "number"
        ? currentEp.number
        : currentEp?.number
        ? Number(currentEp.number)
        : null,
    episodeId: currentEp?.ID ?? null,
    roomId: null,
  });

  const rawSeason = currentSeason?.number;
  const rawEp = currentEp?.number;
  const seasonNum = rawSeason != null ? Number(rawSeason) : NaN;
  const epNum = rawEp != null ? Number(rawEp) : NaN;
  const animeId = details.ID;
  const upcomingSeason = upcomingEpisode?.season;
  const shouldShowUpcoming =
    upcomingEpisode &&
    (upcomingSeason == null || String(upcomingSeason) === String(currentSeason?.number));

  useEffect(() => {
    queueMicrotask(() => setState({ status: "loading" }));
    const ctrl = new AbortController();
    (async () => {
      if (!Number.isFinite(seasonNum) || !Number.isFinite(epNum)) {
        setState({
          status: "error",
          message: "Bölüm numarası bulunamadı.",
        });
        return;
      }
      try {
        const res = await fetch(
          `/api/anizium/episode?animeId=${encodeURIComponent(animeId)}&season=${seasonNum}&episode=${epNum}`,
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
  }, [animeId, episodeId, seasonNum, epNum]);

  const lastSaveRef = useRef(0);
  function onTU(current: number, duration: number) {
    if (!currentEp || duration <= 0) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 4000) return;
    lastSaveRef.current = now;

    const nextWatchEpisode = isEpisodeFinished(current, duration) ? nextEp : null;
    const historyEpisode = nextWatchEpisode?.ep ?? currentEp;
    const historySeason = nextWatchEpisode
      ? details.seasons.find((season) => season.ID === nextWatchEpisode.seasonId) ?? currentSeason
      : currentSeason;

    upsertHistory({
      animeId: details.ID,
      animeName: details.name,
      poster: details.poster ?? details.details_banner ?? null,
      episodeId: historyEpisode.ID,
      episodeName: historyEpisode.name,
      episodeNumber:
        typeof historyEpisode.number === "number"
          ? historyEpisode.number
          : historyEpisode.number
          ? Number(historyEpisode.number)
          : null,
      seasonNumber:
        typeof historySeason?.number === "number"
          ? historySeason.number
          : historySeason?.number
          ? Number(historySeason.number)
          : null,
      progress: nextWatchEpisode ? 0 : current,
      duration: nextWatchEpisode ? 0 : duration,
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
    <div className="watch-page-shell mx-auto max-w-7xl px-4 sm:px-6 py-6 overscroll-contain">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/anime/${encodeURIComponent(details.ID)}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" /> {details.name}
        </Link>
        <div className="hidden sm:flex items-center gap-2">
          {prevEp && (
            <Link
              href={`/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(prevEp.ep.ID)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] min-h-[44px]"
            >
              <SkipBack className="h-3.5 w-3.5" /> Önceki Bölüm
            </Link>
          )}
          {nextEp && (
            <Link
              href={`/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(nextEp.ep.ID)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] min-h-[44px]"
            >
              Sonraki Bölüm <SkipForward className="h-3.5 w-3.5" />
            </Link>
          )}
          {currentEp && (
            <WatchTogetherButton
              animeId={details.ID}
              animeName={details.name}
              episodeId={currentEp.ID}
              episodeName={currentEp.name}
              poster={details.poster ?? details.details_banner ?? null}
            />
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="watch-player-frame">
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
                key={episodeId}
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
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">
                {currentEp?.name ?? "Bölüm"}
              </h1>
              {currentEp?.filler && <FillerBadge className="text-[11px]" />}
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              {currentSeason?.name}
              {currentEp?.number ? ` · Bölüm ${currentEp.number}` : ""}
              {startAt > 5 && state.status === "ready" && (
                <span className="ml-2 inline-block rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[11px] text-[var(--primary)]">
                  {formatDuration(startAt)}&apos;den devam ediyor
                </span>
              )}
            </p>
            {currentEp?.overview && (
              <p className="mt-3 text-sm text-[var(--muted-foreground)] max-w-3xl leading-relaxed">
                {currentEp.overview}
              </p>
            )}

            {/* Mobile episode actions */}
            {(prevEp || nextEp || currentEp) && (
              <div className="mt-4 flex flex-col gap-3 sm:hidden">
                {currentEp && (
                  <WatchTogetherButton
                    animeId={details.ID}
                    animeName={details.name}
                    episodeId={currentEp.ID}
                    episodeName={currentEp.name}
                    poster={details.poster ?? details.details_banner ?? null}
                    className="w-full justify-center"
                  />
                )}
                {(prevEp || nextEp) && (
                  <div className="flex items-center gap-2">
                    {prevEp && (
                      <Link
                        href={`/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(prevEp.ep.ID)}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] py-2.5 text-xs font-medium min-h-[44px]"
                      >
                        <SkipBack className="h-3.5 w-3.5" /> Önceki Bölüm
                      </Link>
                    )}
                    {nextEp && (
                      <Link
                        href={`/izle/${encodeURIComponent(details.ID)}/${encodeURIComponent(nextEp.ep.ID)}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] py-2.5 text-xs font-medium min-h-[44px]"
                      >
                        Sonraki Bölüm <SkipForward className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Episode list sidebar — desktop */}
        <aside className="hidden lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar">
          <h3 className="mb-3 text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
            {currentSeason?.name ?? "Bölümler"}
          </h3>
          <EpisodeList
            animeId={details.ID}
            episodes={currentSeason?.episodes ?? []}
            activeEpisodeId={episodeId}
            upcomingEpisode={shouldShowUpcoming ? upcomingEpisode : null}
            variant="sidebar"
          />
        </aside>
      </div>

      {/* Episode list — mobile collapsible */}
      <MobileEpisodeSection
        animeId={details.ID}
        episodes={currentSeason?.episodes ?? []}
        activeEpisodeId={episodeId}
        upcomingEpisode={shouldShowUpcoming ? upcomingEpisode : null}
        title={currentSeason?.name ?? "Bölümler"}
      />

    </div>
  );
}

function MobileEpisodeSection({
  animeId,
  episodes,
  activeEpisodeId,
  upcomingEpisode,
  title,
}: {
  animeId: string;
  episodes: EpisodeData[];
  activeEpisodeId: string;
  upcomingEpisode?: UpcomingEpisodePlaceholder | null;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  if (episodes.length === 0) return null;

  return (
    <div className="mt-6 lg:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-semibold min-h-[48px]"
        aria-expanded={open}
      >
        <span>{title} ({episodes.length} bölüm)</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-3 max-h-[60vh] overflow-y-auto no-scrollbar">
          <EpisodeList
            animeId={animeId}
            episodes={episodes}
            activeEpisodeId={activeEpisodeId}
            upcomingEpisode={upcomingEpisode}
            variant="sidebar"
          />
        </div>
      )}
    </div>
  );
}
