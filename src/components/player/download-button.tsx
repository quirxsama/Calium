"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Check, Loader2, X } from "lucide-react";
import type { SourceGroup, SubtitleData } from "@/lib/anizium/schemas";
import { cn } from "@/lib/utils";
import { isEpisodeDownloaded, deleteOfflineEpisode, offlineEpisodeKey } from "@/lib/storage/offline-episodes";
import { useDownloadQueue } from "@/hooks/use-download-queue";

type Props = {
  animeId: string;
  animeName: string;
  poster: string | null;
  episodeId: string;
  episodeName: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  groups: SourceGroup[];
  subtitles: SubtitleData[];
  className?: string;
};

type QualityVariant = {
  url: string;
  quality?: number;
  type?: string;
  label: string;
};

type AudioTrack = {
  id: string;
  label: string;
  variants: QualityVariant[];
};

function isHls(url: string, type?: string): boolean {
  if (type?.includes("mpegurl") || type?.includes("m3u8") || type === "hls") return true;
  return url.includes(".m3u8");
}

export function DownloadButton({
  animeId, animeName, poster, episodeId, episodeName, episodeNumber, seasonNumber,
  groups, subtitles, className,
}: Props) {
  const { queue, enqueue, cancel: cancelQueue } = useDownloadQueue();
  const [open, setOpen] = useState(false);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState(false);
  const [checkingDownloaded, setCheckingDownloaded] = useState(false);

  const audioTracks = useMemo<AudioTrack[]>(() => {
    const labelCounts = new Map<string, number>();
    return groups
      .map((g, i) => {
        const variants: QualityVariant[] = (g.items ?? [])
          .filter((s) => !!s.link && !isHls(s.link, s.type ?? g.type ?? undefined))
          .map((s) => ({
            url: s.link,
            quality: typeof s.quality === "number" ? s.quality : Number(s.quality) || undefined,
            type: s.type ?? g.type ?? undefined,
            label: s.quality != null ? `${s.quality}p` : `Kaynak ${i + 1}`,
          }))
          .sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));

        let label = (g.name ?? g.group ?? g.platform ?? "").trim();
        if (!label) label = `Ses ${i + 1}`;
        const seen = labelCounts.get(label) ?? 0;
        labelCounts.set(label, seen + 1);
        if (seen > 0) label = `${label} ${seen + 1}`;

        return { id: `${i}`, label, variants };
      })
      .filter((t) => t.variants.length > 0);
  }, [groups]);

  const [selectedAudioIdx, setSelectedAudioIdx] = useState(0);
  const [selectedQualityIdx, setSelectedQualityIdx] = useState(0);
  const [selectedSubs, setSelectedSubs] = useState<Set<number>>(new Set());

  const currentTrack = audioTracks[selectedAudioIdx];
  const currentVariant = currentTrack?.variants[selectedQualityIdx];
  const canDownload = audioTracks.length > 0 && !!currentVariant;

  const qualityOptions = useMemo(() => currentTrack?.variants ?? [], [currentTrack]);
  const subtitleOptions = useMemo(() => subtitles, [subtitles]);

  const queueItem = useMemo(() => {
    if (!currentTrack || !currentVariant) return null;
    const key = offlineEpisodeKey(animeId, episodeId, currentVariant.label ?? "auto", currentTrack.label);
    return queue.find((q) => q.id === key) ?? null;
  }, [queue, animeId, episodeId, currentTrack, currentVariant]);

  useEffect(() => {
    if (qualityOptions.length > 0) {
      queueMicrotask(() => setSelectedQualityIdx(0));
    }
  }, [selectedAudioIdx, qualityOptions.length]);

  useEffect(() => {
    const indexes = new Set(subtitleOptions.map((_, i) => i));
    queueMicrotask(() => setSelectedSubs(indexes));
  }, [subtitleOptions]);

  useEffect(() => {
    if (!open || !currentTrack || !currentVariant) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setCheckingDownloaded(true); });
    const key = offlineEpisodeKey(animeId, episodeId, currentVariant.label ?? "auto", currentTrack.label);
    isEpisodeDownloaded(key).then((downloaded) => {
      if (!cancelled) {
        setAlreadyDownloaded(downloaded);
        setCheckingDownloaded(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animeId, episodeId, currentVariant?.label, currentTrack?.label]);

  const handleEnqueue = useCallback(() => {
    if (!currentVariant || !currentTrack) return;
    enqueue({
      animeId, animeName, poster, episodeId, episodeName, episodeNumber, seasonNumber,
      videoUrl: currentVariant.url,
      videoType: currentVariant.type ?? "video/mp4",
      quality: currentVariant.label ?? null,
      dubLabel: currentTrack.label,
      subtitles: subtitleOptions,
      selectedSubs: [...selectedSubs],
    });
    setOpen(false);
  }, [
    animeId, animeName, poster, episodeId, episodeName, episodeNumber, seasonNumber,
    currentVariant, currentTrack, subtitleOptions, selectedSubs, enqueue,
  ]);

  const handleDelete = useCallback(async () => {
    const key = offlineEpisodeKey(animeId, episodeId, currentVariant?.label ?? "auto", currentTrack?.label ?? "default");
    await deleteOfflineEpisode(key);
    setAlreadyDownloaded(false);
  }, [animeId, episodeId, currentVariant?.label, currentTrack?.label]);

  const hasQueueItem = queueItem && (queueItem.status === "queued" || queueItem.status === "downloading");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] min-h-[36px]",
          alreadyDownloaded && "border-[var(--primary)] text-[var(--primary)]",
          hasQueueItem && "border-[var(--primary)]/50 bg-[var(--primary)]/5",
          className
        )}
      >
        {hasQueueItem ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {queueItem?.progress ?? 0}%
          </>
        ) : alreadyDownloaded ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownToLine className="h-3.5 w-3.5" />
        )}
        {hasQueueItem ? "İniyor" : "İndir"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-[min(92vw,420px)] max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Bölümü İndir</h3>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{episodeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!canDownload ? (
              <p className="mt-3 text-xs text-red-500">Bu bölüm için indirilebilir kaynak bulunamadı. HLS akışlar indirilemez.</p>
            ) : (
              <>
                {audioTracks.length > 1 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Ses / Dublaj</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {audioTracks.map((track, i) => (
                        <button key={track.id} type="button" onClick={() => setSelectedAudioIdx(i)}
                          className={cn("rounded-full border px-2.5 py-1 text-[11px] transition",
                            i === selectedAudioIdx ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]")}
                        >{track.label}</button>
                      ))}
                    </div>
                  </div>
                )}

                {qualityOptions.length > 1 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Kalite</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {qualityOptions.map((q, i) => (
                        <button key={i} type="button" onClick={() => setSelectedQualityIdx(i)}
                          className={cn("rounded-full border px-2.5 py-1 text-[11px] transition",
                            i === selectedQualityIdx ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]")}
                        >{q.label}</button>
                      ))}
                    </div>
                  </div>
                )}

                {subtitleOptions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Altyazı</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {subtitleOptions.map((sub, i) => (
                        <button key={i} type="button" onClick={() => setSelectedSubs((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                          className={cn("rounded-full border px-2.5 py-1 text-[11px] transition",
                            selectedSubs.has(i) ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]")}
                        >{sub.name}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  {hasQueueItem ? (
                    <button type="button" onClick={() => cancelQueue(queueItem!.id)}
                      className="rounded-full border border-red-500/40 px-3 py-1.5 text-[11px] text-red-500">İptal</button>
                  ) : checkingDownloaded ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted-foreground)]" />
                  ) : alreadyDownloaded ? (
                    <button type="button" onClick={handleDelete}
                      className="rounded-full border border-red-500/40 px-3 py-1.5 text-[11px] text-red-500">Sil</button>
                  ) : (
                    <div />
                  )}
                  <button type="button" disabled={!canDownload} onClick={handleEnqueue}
                    className="rounded-full bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50">
                    Kuyruğa Ekle
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
