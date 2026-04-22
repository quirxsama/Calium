"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { useHistory } from "@/hooks/use-history";
import { formatDuration } from "@/lib/utils";

export function EngagementPanels() {
  const history = useHistory();
  const [episodeThumb, setEpisodeThumb] = useState<{ key: string; url: string | null } | null>(null);

  const continueItem = history[0];
  const continueAnimeId = continueItem?.animeId ?? null;
  const continueEpisodeId = continueItem?.episodeId ?? null;
  const currentEpisodeKey = continueItem
    ? `${continueItem.animeId}:${continueItem.episodeId}`
    : null;

  useEffect(() => {
    if (!continueAnimeId || !continueEpisodeId || !currentEpisodeKey) return;

    const ctrl = new AbortController();
    fetch(`/api/anizium/anime/${encodeURIComponent(continueAnimeId)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: { success?: boolean; data?: { seasons?: Array<{ episodes?: Array<{ ID: string; banner_link?: string | null }> }> } }) => {
        if (!data?.success) {
          setEpisodeThumb({ key: currentEpisodeKey, url: null });
          return;
        }

        const seasons = data.data?.seasons ?? [];
        const episode = seasons
          .flatMap((season) => season.episodes ?? [])
          .find((ep) => ep.ID === continueEpisodeId);

        setEpisodeThumb({ key: currentEpisodeKey, url: episode?.banner_link ?? null });
      })
      .catch(() => {
        setEpisodeThumb({ key: currentEpisodeKey, url: null });
      });

    return () => ctrl.abort();
  }, [continueAnimeId, continueEpisodeId, currentEpisodeKey]);

  const completionRate = continueItem?.duration
    ? Math.min(100, Math.round((continueItem.progress / continueItem.duration) * 100))
    : 0;
  const imageSrc =
    currentEpisodeKey && episodeThumb?.key === currentEpisodeKey
      ? (episodeThumb.url ?? continueItem?.poster ?? null)
      : (continueItem?.poster ?? null);

  return (
    <section className="mb-10 md:mb-14">
      <div className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(99,102,241,0.14),rgba(16,185,129,0.06),rgba(15,23,42,0.90))] p-5 shadow-xl md:p-6">
        <div className="flex flex-col justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Senin için</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl">
              {continueItem
                ? `${continueItem.animeName} için kaldığın yerden devam et!`
                : "İlk bölümü aç, devam kartını burada gör"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">
              {continueItem
                ? `%${completionRate} tamamlandı. Son oturumun tüm detaylarıyla burada hazır.`
                : "İzleme geçmişin oluştuğunda son anime posteri ve bölüm bilgileri bu alanda görünecek."}
            </p>

            <div className="mt-4 max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-black/30">
              {imageSrc ? (
                <div className="relative aspect-video w-full">
                  <Image
                    src={imageSrc}
                    alt={continueItem.animeName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 768px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="line-clamp-1 text-sm font-bold text-white">{continueItem.animeName}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-white/80">
                      {continueItem.seasonNumber ? `S${continueItem.seasonNumber} · ` : ""}
                      {continueItem.episodeNumber ? `B${continueItem.episodeNumber} · ` : ""}
                      {continueItem.episodeName}
                    </p>
                    <p className="mt-2 text-[11px] font-medium text-white/70">Bölüm detayları kaydedildi</p>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center p-4 text-center text-xs text-white/70">
                  Son izlenen bölüm görseli henüz yok.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-white/90">
            <Link
              href={
                continueItem
                  ? `/izle/${encodeURIComponent(continueItem.animeId)}/${encodeURIComponent(continueItem.episodeId)}`
                  : "/kesfet"
              }
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.01]"
            >
              <PlayCircle className="h-4 w-4" />
              {continueItem ? "Kaldığın yerden aç" : "İzlemeye başla"}
            </Link>
            {continueItem && (
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                {formatDuration(continueItem.progress)} / {formatDuration(continueItem.duration)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
