"use client";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
  type MediaCanPlayDetail,
  type MediaTimeUpdateEventDetail,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import type { SourceGroup, SubtitleData } from "@/lib/anizium/schemas";
import { TURKISH_TRANSLATIONS } from "./translations";
import { AudioTrackMenuItem, CaptionStyleSubmenu, QualityMenuItem } from "./player-menus";
import { useCaptionSettings } from "@/hooks/use-caption-settings";
import { buildCaptionCssVars } from "@/lib/storage/caption-settings";

type Props = {
  groups: SourceGroup[];
  subtitles: SubtitleData[];
  poster?: string | null;
  title: string;
  startAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  storageKey?: string;
};

type QualityVariant = {
  url: string;
  quality?: number;
  type?: string;
};

type AudioTrack = {
  id: string;
  label: string;
  variants: QualityVariant[];
};

function groupLabel(g: SourceGroup, index: number): string {
  const raw = (g.name ?? g.group ?? g.platform ?? "").trim();
  if (raw) return raw;
  return `Ses ${index + 1}`;
}

function isTurkish(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("tur") || lower.includes("türk");
}

function srtToVttUrl(link: string, name: string): string {
  // Link zaten .vtt ise olduğu gibi kullan; .srt ise basit düzlem dönüşüm client'ta yapılır.
  return link;
}

type MediaType =
  | "application/x-mpegurl"
  | "video/mp4"
  | "video/webm";

function detectType(link: string, type?: string | null): MediaType {
  if (type) {
    if (type.includes("mpegurl") || type.includes("m3u8") || type === "hls") return "application/x-mpegurl";
    if (type.includes("webm")) return "video/webm";
    if (type.includes("mp4")) return "video/mp4";
  }
  if (link.includes(".m3u8")) return "application/x-mpegurl";
  if (link.includes(".webm")) return "video/webm";
  return "video/mp4";
}

export function AnimePlayer({
  groups,
  subtitles,
  poster,
  title,
  startAt,
  onTimeUpdate,
  onEnded,
}: Props) {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const seededRef = useRef(false);

  const audioTracks = useMemo<AudioTrack[]>(() => {
    const labelCounts = new Map<string, number>();
    return groups
      .map((g, i) => {
        const variants: QualityVariant[] = (g.items ?? [])
          .filter((s) => !!s.link)
          .map((s) => ({
            url: s.link,
            quality:
              typeof s.quality === "number"
                ? s.quality
                : Number(s.quality) || undefined,
            type: s.type ?? g.type ?? undefined,
          }))
          .sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));
        let label = groupLabel(g, i);
        const seen = labelCounts.get(label) ?? 0;
        labelCounts.set(label, seen + 1);
        if (seen > 0) label = `${label} ${seen + 1}`;
        return { id: `${i}`, label, variants };
      })
      .filter((t) => t.variants.length > 0);
  }, [groups]);

  const [activeAudio, setActiveAudio] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const currentTrack = audioTracks[activeAudio];
  const active = currentTrack?.variants[activeIdx];
  const resumeFromRef = useRef<number | null>(null);
  const { settings, update: updateCaption, reset: resetCaption } = useCaptionSettings();

  // Resume handling — also preserves time on quality switches.
  useEffect(() => {
    seededRef.current = false;
  }, [active?.url]);

  function changeQuality(idx: number) {
    if (idx === activeIdx) return;
    const p = playerRef.current;
    if (p) resumeFromRef.current = p.currentTime;
    setActiveIdx(idx);
  }

  function changeAudio(idx: number) {
    if (idx === activeAudio) return;
    const p = playerRef.current;
    if (p) resumeFromRef.current = p.currentTime;
    const nextTrack = audioTracks[idx];
    const currentQ = currentTrack?.variants[activeIdx]?.quality;
    let nextQIdx = 0;
    if (nextTrack && currentQ != null) {
      const match = nextTrack.variants.findIndex((v) => v.quality === currentQ);
      if (match >= 0) nextQIdx = match;
    }
    setActiveAudio(idx);
    setActiveIdx(nextQIdx);
  }

  function onCanPlay(_: MediaCanPlayDetail, _nativeEvent: Event) {
    const p = playerRef.current;
    if (!p) return;
    if (seededRef.current) return;
    const seekTo = resumeFromRef.current ?? (startAt && startAt > 5 ? startAt : null);
    const duration = p.state.duration || Infinity;
    if (seekTo && seekTo > 1 && seekTo < duration - 5) {
      p.currentTime = seekTo;
    }
    resumeFromRef.current = null;
    seededRef.current = true;
  }

  function onTU(detail: MediaTimeUpdateEventDetail) {
    if (!onTimeUpdate) return;
    const d = playerRef.current?.state.duration ?? 0;
    onTimeUpdate(detail.currentTime, d);
  }

  if (!active) {
    return (
      <div className="aspect-video w-full rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-center text-[var(--muted-foreground)]">
        Oynatılabilir kaynak bulunamadı.
      </div>
    );
  }

  const qualityOptions = useMemo(
    () =>
      (currentTrack?.variants ?? []).map((s, i) => ({
        label: s.quality ? `${s.quality}p` : `Kaynak ${i + 1}`,
        value: String(i),
      })),
    [currentTrack]
  );

  const audioOptions = useMemo(
    () =>
      audioTracks.map((t) => ({
        label: t.label,
        value: t.id,
      })),
    [audioTracks]
  );

  const cueStyle = useMemo(
    () => buildCaptionCssVars(settings) as unknown as React.CSSProperties,
    [settings]
  );

  // Altyazıları varsayılan olarak aç — Türkçe track'i aktif et
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const off = p.subscribe(({ textTrack }) => {
      if (textTrack?.mode !== "showing") {
        const trTrack = p.textTracks.toArray().find(
          (t) => isTurkish(t.label ?? "")
        );
        if (trTrack) trTrack.mode = "showing";
      }
    });
    return off;
  }, []);

  return (
    <div className="w-full" style={cueStyle}>
      <MediaPlayer
        ref={playerRef}
        title={title}
        src={{ src: active.url, type: detectType(active.url, active.type) }}
        crossOrigin
        playsInline
        aspectRatio="16/9"
        onCanPlay={onCanPlay}
        onTimeUpdate={onTU}
        onEnded={onEnded}
        className="anizium-player w-full overflow-hidden rounded-xl border border-[var(--border)] bg-black"
      >
        <MediaProvider>
          {poster && <Poster className="vds-poster" src={poster} alt={title} />}
          {subtitles.map((sub, i) => (
            <Track
              key={`${sub.name}-${i}`}
              src={srtToVttUrl(sub.link, sub.name)}
              kind="subtitles"
              label={sub.name}
              language={isTurkish(sub.name) ? "tr" : "en"}
              default={isTurkish(sub.name)}
            />
          ))}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          translations={TURKISH_TRANSLATIONS}
          slots={{
            settingsMenuItemsStart: (
              <>
                <AudioTrackMenuItem
                  options={audioOptions}
                  value={String(activeAudio)}
                  onChange={(v) => changeAudio(Number(v))}
                />
                <QualityMenuItem
                  options={qualityOptions}
                  value={String(activeIdx)}
                  onChange={(v) => changeQuality(Number(v))}
                />
              </>
            ),
            accessibilityMenuItemsEnd: (
              <CaptionStyleSubmenu
                settings={settings}
                onUpdate={updateCaption}
                onReset={resetCaption}
              />
            ),
          }}
        />
      </MediaPlayer>
    </div>
  );
}
