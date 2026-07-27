"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownToLine, Play, Trash2 } from "lucide-react";
import type { OfflineEpisodeMeta } from "@/lib/storage/offline-episodes";
import {
  getAllOfflineEpisodeMetas,
  deleteOfflineEpisode,
  getOfflineEpisode,
  type OfflineEpisode,
} from "@/lib/storage/offline-episodes";

export default function IndirilenlerPage() {
  const [episodes, setEpisodes] = useState<OfflineEpisodeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingEpisode, setPlayingEpisode] = useState<OfflineEpisode | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [subtitleUrls, setSubtitleUrls] = useState<{ name: string; language: string | null; url: string }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    getAllOfflineEpisodeMetas().then((list) => {
      setEpisodes(list);
      setLoading(false);
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteOfflineEpisode(id);
    const list = await getAllOfflineEpisodeMetas();
    setEpisodes(list);
  }, []);

  const handlePlay = useCallback(async (id: string) => {
    const ep = await getOfflineEpisode(id);
    if (!ep) return;

    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    for (const s of subtitleUrls) URL.revokeObjectURL(s.url);

    const videoUrl = URL.createObjectURL(ep.videoBlob);
    const subUrls = ep.subtitles.map((s) => ({
      name: s.name,
      language: s.language,
      url: URL.createObjectURL(s.vttBlob),
    }));

    setPlaybackUrl(videoUrl);
    setSubtitleUrls(subUrls);
    setPlayingEpisode(ep);
  }, [playbackUrl, subtitleUrls]);

  const handleClosePlayer = useCallback(() => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    for (const s of subtitleUrls) URL.revokeObjectURL(s.url);
    setPlaybackUrl(null);
    setSubtitleUrls([]);
    setPlayingEpisode(null);
  }, [playbackUrl, subtitleUrls]);

  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      for (const s of subtitleUrls) URL.revokeObjectURL(s.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      {playingEpisode && playbackUrl ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{playingEpisode.episodeName}</h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {playingEpisode.animeName}
                {playingEpisode.dubLabel ? ` · ${playingEpisode.dubLabel}` : ""}
                {playingEpisode.quality ? ` · ${playingEpisode.quality}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClosePlayer}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)]"
            >
              Listeye Dön
            </button>
          </div>
          <video
            ref={videoRef}
            src={playbackUrl}
            controls
            autoPlay
            playsInline
            className="w-full rounded-xl border border-[var(--border)] bg-black"
            style={{ aspectRatio: "16/9" }}
          >
            {subtitleUrls.map((sub, i) => (
              <track
                key={i}
                src={sub.url}
                kind="subtitles"
                label={sub.name}
                srcLang={sub.language ?? undefined}
                default={i === 0}
              />
            ))}
          </video>
        </div>
      ) : (
        <>
          <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">İndirilen Bölümler</h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Çevrimdışı izlemek üzere tarayıcına kaydettiğin bölümler burada görünür.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/kesfet"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]"
              >
                <ArrowDownToLine className="h-4 w-4" /> Yeni bölüm indir
              </Link>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[linear-gradient(180deg,var(--card),color-mix(in_oklab,var(--card)_82%,var(--primary)_18%))] px-6 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--primary)]/12 text-[var(--primary)]">
                <ArrowDownToLine className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight">Henüz bölüm indirmedin</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--muted-foreground)] md:text-base">
                İzlediğin bir bölüm sayfasında &quot;İndir&quot; butonuna tıklayarak bölümü çevrimdışı izlemek üzere tarayıcına kaydedebilirsin.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/kesfet"
                  className="inline-flex items-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
                >
                  İzlemeye başla
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Toplam bölüm</p>
                  <p className="mt-3 text-2xl font-black">{episodes.length}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">İndirilmiş bölüm sayısı</p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Toplam boyut</p>
                  <p className="mt-3 text-2xl font-black">
                    {formatBytes(episodes.reduce((sum, ep) => sum + ep.totalBytes, 0))}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Tarayıcı depolaması kullanılıyor</p>
                </div>
              </section>

              <div className="space-y-3">
                {episodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                  >
                    <div className="relative h-20 w-32 shrink-0 rounded-lg overflow-hidden bg-[var(--muted)]">
                      {ep.poster && (
                        <Image
                          src={ep.poster}
                          alt={ep.animeName}
                          fill
                          sizes="128px"
                          className="object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => void handlePlay(ep.id)}
                        className="absolute inset-0 bg-black/30 flex items-center justify-center hover:opacity-100 opacity-0 transition-opacity"
                      >
                        <Play className="h-6 w-6 fill-white text-white" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/anime/${encodeURIComponent(ep.animeId)}`}
                        className="font-semibold hover:text-[var(--primary)] line-clamp-1"
                      >
                        {ep.animeName}
                      </Link>
                      <p className="text-sm text-[var(--muted-foreground)] line-clamp-1">
                        {ep.seasonNumber ? `S${ep.seasonNumber} · ` : ""}
                        {ep.episodeNumber ? `B${ep.episodeNumber} · ` : ""}
                        {ep.episodeName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {ep.dubLabel && <span>{ep.dubLabel}{ep.quality ? ` · ${ep.quality}` : ""}{ep.subtitleCount > 0 ? " · " : ""}</span>}
                        {ep.subtitleCount > 0 && <span>{ep.subtitleCount} altyazı</span>}
                        <span className="ml-2">{formatBytes(ep.totalBytes)}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handlePlay(ep.id)}
                          className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]"
                        >
                          Çevrimdışı İzle
                        </button>
                        <Link
                          href={`/anime/${encodeURIComponent(ep.animeId)}`}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
                        >
                          Anime sayfası
                        </Link>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(ep.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] hover:bg-red-500/10 hover:text-red-500"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
