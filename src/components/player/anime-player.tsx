"use client";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
  type MediaTimeUpdateEventDetail,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { SkipForward } from "lucide-react";
import type { SourceGroup, SubtitleData } from "@/lib/anizium/schemas";
import { TURKISH_TRANSLATIONS } from "./translations";
import { AudioTrackMenuItem, CaptionStyleSubmenu, QualityMenuItem } from "./player-menus";
import { useCaptionSettings } from "@/hooks/use-caption-settings";
import { buildCaptionCssVars } from "@/lib/storage/caption-settings";
import { cn } from "@/lib/utils";
import { MobileSeekOverlay } from "./mobile-seek-overlay";
import { GestureHint } from "./gesture-hint";
const AUDIO_STORAGE_KEY = "anizium-audio-track";
const VOLUME_STORAGE_KEY = "anizium-player-volume";

type Props = {
  groups: SourceGroup[];
  subtitles: SubtitleData[];
  poster?: string | null;
  title: string;
  startAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeeked?: (time: number) => void;
  onPlayerReady?: (player: MediaPlayerInstance) => void;
  storageKey?: string;
  introStart?: number | null;
  introEnd?: number | null;
  outroStart?: number | null;
  nextEpisodeHref?: string | null;
  onNextEpisode?: () => void;
  overlayTopRight?: ReactNode;
  overlayPersistentTopRight?: ReactNode;
  overlayRightRail?: ReactNode;
  onFullscreenChange?: (fullscreen: boolean) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
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

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body.trim()}\n`;
}

function isSrtLink(link: string): boolean {
  return /\.srt(\?|$)/i.test(link);
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
  onPlay,
  onPause,
  onSeeked,
  onPlayerReady,
  introStart,
  introEnd,
  outroStart,
  nextEpisodeHref,
  onNextEpisode,
  overlayTopRight,
  overlayPersistentTopRight,
  overlayRightRail,
  onFullscreenChange,
  onControlsVisibilityChange,
}: Props) {
  const router = useRouter();
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const seededRef = useRef(false);
  const readyFiredRef = useRef(false);
  const overlayControlsTimerRef = useRef<number | null>(null);
  const orientationLockedRef = useRef(false);
  const outroTimerRef = useRef<number | null>(null);
  const outroStartRef = useRef<number | null>(null);
  const fullscreenResumePendingRef = useRef(false);
  const [showIntroSkip, setShowIntroSkip] = useState(false);
  const [showOutroSkip, setShowOutroSkip] = useState(false);
  const [outroProgress, setOutroProgress] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isTouchDevice] = useState(
    () => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );

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

  const [activeAudio, setActiveAudio] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!saved) return 0;
    const idx = Number(saved);
    return idx < groups.length ? idx : 0;
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    return saved ? Number(saved) : 1;
  });
  const currentTrack = audioTracks[activeAudio];
  const active = currentTrack?.variants[activeIdx];
  const resumeFromRef = useRef<number | null>(null);
  const { settings, update: updateCaption, reset: resetCaption } = useCaptionSettings();
  const [resolvedSubtitles, setResolvedSubtitles] = useState<SubtitleData[]>(subtitles);

  // SRT formundaki altyazıları client-side VTT'ye çevir ve Blob URL'ine map'le.
  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];
    (async () => {
      const resolved = await Promise.all(
        subtitles.map(async (sub) => {
          if (!isSrtLink(sub.link)) return sub;
          try {
            const res = await fetch(sub.link);
            if (!res.ok) return sub;
            const text = await res.text();
            const vtt = srtToVtt(text);
            const blob = new Blob([vtt], { type: "text/vtt" });
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            return { ...sub, link: url };
          } catch {
            return sub;
          }
        })
      );
      if (!cancelled) setResolvedSubtitles(resolved);
    })();
    return () => {
      cancelled = true;
      for (const u of createdUrls) URL.revokeObjectURL(u);
    };
  }, [subtitles]);

  // Resume handling — also preserves time on quality switches.
  useEffect(() => {
    seededRef.current = false;
  }, [active?.url]);

  useEffect(() => {
    if (!showOutroSkip || (!nextEpisodeHref && !onNextEpisode)) {
      if (outroTimerRef.current) {
        window.clearInterval(outroTimerRef.current);
        outroTimerRef.current = null;
      }
      outroStartRef.current = null;
      setOutroProgress(0);
      return;
    }

    if (outroTimerRef.current) return;

    const totalMs = 6000;
    const startedAt = Date.now();
    outroStartRef.current = startedAt;
    setOutroProgress(0);

    outroTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / totalMs);
      setOutroProgress(progress);
      if (elapsed >= totalMs) {
        if (outroTimerRef.current) {
          window.clearInterval(outroTimerRef.current);
          outroTimerRef.current = null;
        }
        outroStartRef.current = null;
        setOutroProgress(1);
        if (onNextEpisode) {
          onNextEpisode();
        } else if (nextEpisodeHref) {
          router.push(nextEpisodeHref);
        }
      }
    }, 100);

    return () => {
      if (outroTimerRef.current) {
        window.clearInterval(outroTimerRef.current);
        outroTimerRef.current = null;
      }
      outroStartRef.current = null;
    };
  }, [showOutroSkip, nextEpisodeHref, onNextEpisode, router]);

  const cancelOutroAutoAdvance = useCallback(() => {
    if (outroTimerRef.current) {
      window.clearInterval(outroTimerRef.current);
      outroTimerRef.current = null;
    }
    outroStartRef.current = null;
    setOutroProgress(0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldRestore = sessionStorage.getItem("anizium:resume-fullscreen") === "1";
    if (shouldRestore) {
      fullscreenResumePendingRef.current = true;
      sessionStorage.removeItem("anizium:resume-fullscreen");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (outroTimerRef.current) {
        window.clearInterval(outroTimerRef.current);
        outroTimerRef.current = null;
      }
      if (overlayControlsTimerRef.current) {
        window.clearTimeout(overlayControlsTimerRef.current);
        overlayControlsTimerRef.current = null;
      }
      sessionStorage.removeItem("anizium:resume-fullscreen");
    };
  }, []);

  function changeQuality(idx: number) {
    if (idx === activeIdx) return;
    cancelOutroAutoAdvance();
    const p = playerRef.current;
    if (p) resumeFromRef.current = p.currentTime;
    setActiveIdx(idx);
  }

  function changeAudio(idx: number) {
    if (idx === activeAudio) return;
    cancelOutroAutoAdvance();
    const p = playerRef.current;
    if (p) resumeFromRef.current = p.currentTime;
    const nextTrack = audioTracks[idx];
    const currentQ = currentTrack?.variants[activeIdx]?.quality;
    let nextQIdx = 0;
    if (nextTrack && currentQ != null) {
      const match = nextTrack.variants.findIndex((v) => v.quality === currentQ);
      if (match >= 0) nextQIdx = match;
    }
    localStorage.setItem(AUDIO_STORAGE_KEY, String(idx));
    setActiveAudio(idx);
    setActiveIdx(nextQIdx);
  }

  function onCanPlay() {
    const p = playerRef.current;
    if (!p) return;
    if (onPlayerReady && !readyFiredRef.current) {
      readyFiredRef.current = true;
      onPlayerReady(p);
    }
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
    const t = detail.currentTime;
    // Intro skip visibility
    if (introStart != null && introEnd != null && introEnd > introStart) {
      setShowIntroSkip(t >= introStart && t < introEnd);
    }
    // Outro skip visibility
    if (outroStart != null && outroStart > 0) {
      setShowOutroSkip(t >= outroStart);
    } else {
      setShowOutroSkip(false);
    }
    if (!onTimeUpdate) return;
    const d = playerRef.current?.state.duration ?? 0;
    onTimeUpdate(t, d);
  }

  function skipIntro() {
    const p = playerRef.current;
    if (p && introEnd != null) {
      cancelOutroAutoAdvance();
      p.currentTime = introEnd;
      setShowIntroSkip(false);
    }
  }

  function goNextEpisode() {
    const isFullscreen = Boolean(document.fullscreenElement);
    fullscreenResumePendingRef.current = isFullscreen;
    if (typeof window !== "undefined") {
      if (isFullscreen) sessionStorage.setItem("anizium:resume-fullscreen", "1");
      else sessionStorage.removeItem("anizium:resume-fullscreen");
    }
    cancelOutroAutoAdvance();
    if (onNextEpisode) {
      onNextEpisode();
      return;
    }
    if (nextEpisodeHref) {
      router.push(nextEpisodeHref);
    }
  }

  const outroBarStyle = useMemo(() => ({ transform: `scaleX(${outroProgress})` }), [outroProgress]);

  const showOverlayControls = useCallback(() => {
    setControlsVisible(true);
    onControlsVisibilityChange?.(true);

    if (overlayControlsTimerRef.current) {
      window.clearTimeout(overlayControlsTimerRef.current);
    }

    overlayControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      onControlsVisibilityChange?.(false);
      overlayControlsTimerRef.current = null;
    }, 2200);
  }, [onControlsVisibilityChange]);

  const hideOverlayControls = useCallback(() => {
    if (overlayControlsTimerRef.current) {
      window.clearTimeout(overlayControlsTimerRef.current);
      overlayControlsTimerRef.current = null;
    }

    setControlsVisible(false);
    onControlsVisibilityChange?.(false);
  }, [onControlsVisibilityChange]);



  // Klavye kontrollerini kilitle ve odak yönetimini sağla
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    const el = p.el;
    if (!el) return;
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // Player'ın kendisi focuslanabilir olsun
    el.setAttribute("tabindex", "0");

    // Kontrol öğesi focus'tayken tehlikeli tuşları engelle
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const tag = target.tagName.toLowerCase();
      const role = target.getAttribute("role") ?? "";

      const isControl =
        ["button", "input", "a"].includes(tag) ||
        ["button", "slider", "menuitem", "option"].includes(role);

      if (isControl) {
        const blocked = [" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
        if (blocked.includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    el.addEventListener("keydown", handleKeydown, true);

    const disableTab = () => {
      const focusables = el.querySelectorAll(
        'button, [role="button"], [role="slider"], [role="menuitem"], input, a, [tabindex]'
      );
      for (let i = 0; i < focusables.length; i++) {
        const item = focusables[i];
        if (item !== el && item.getAttribute("tabindex") !== "-1") {
          item.setAttribute("tabindex", "-1");
        }
      }
    };

    disableTab();

    let rafId: number | null = null;
    const debouncedDisableTab = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        disableTab();
        rafId = null;
      });
    };

    const observer = new MutationObserver(debouncedDisableTab);
    observer.observe(el, { childList: true, subtree: true });

    const blockMobileDoubleClick = (e: MouseEvent) => {
      if (!isTouch) return;

      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'button, [role="button"], [role="slider"], [role="menuitem"], [role="menu"], input, a, .vds-controls, .vds-menu'
        )
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
    };

    const lockLandscapeOrientation = async () => {
      if (!isTouch || orientationLockedRef.current) return;

      const orientationApi = screen.orientation as (ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
        unlock?: () => void;
      }) | undefined;

      if (!orientationApi?.lock) return;

      try {
        await orientationApi.lock("landscape");
        orientationLockedRef.current = true;
      } catch {}
    };

    const unlockOrientation = () => {
      const orientationApi = screen.orientation as (ScreenOrientation & {
        unlock?: () => void;
      }) | undefined;

      if (!orientationLockedRef.current || !orientationApi?.unlock) return;

      try {
        orientationApi.unlock();
      } catch {}

      orientationLockedRef.current = false;
    };

    // Fullscreen'e girince otomatik focusla
    const handleVidstackFullscreenChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (detail && !isTouch) el.focus();
      if (detail) {
        void lockLandscapeOrientation();
      } else {
        unlockOrientation();
      }
      onFullscreenChange?.(Boolean(detail));
    };

    const onNativeFullscreenChange = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      if (fullscreen && !isTouch) el.focus();
      if (fullscreen) {
        void lockLandscapeOrientation();
      } else {
        unlockOrientation();
      }
      onFullscreenChange?.(fullscreen);
    };

    el.addEventListener("fullscreen-change", handleVidstackFullscreenChange);
    el.addEventListener("dblclick", blockMobileDoubleClick, true);
    document.addEventListener("fullscreenchange", onNativeFullscreenChange);

    return () => {
      el.removeEventListener("keydown", handleKeydown, true);
      el.removeEventListener("fullscreen-change", handleVidstackFullscreenChange);
      el.removeEventListener("dblclick", blockMobileDoubleClick, true);
      document.removeEventListener("fullscreenchange", onNativeFullscreenChange);
      unlockOrientation();
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [onFullscreenChange]);

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

  // Altyazıları varsayılan olarak aç — Türkçe track'i bir kez aktif et
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    let done = false;
    const off = p.subscribe(() => {
      if (done) return;
      const tracks = p.textTracks.toArray();
      if (tracks.length === 0) return;
      done = true;
      const trTrack = tracks.find((t) => isTurkish(t.label ?? ""));
      if (trTrack) trTrack.mode = "showing";
    });
    return off;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      showOverlayControls();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (overlayControlsTimerRef.current) {
        window.clearTimeout(overlayControlsTimerRef.current);
        overlayControlsTimerRef.current = null;
      }
    };
  }, [active?.url, showOverlayControls]);

  if (!active) {
    return (
      <div className="aspect-video w-full rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-center text-[var(--muted-foreground)]">
        Oynatılabilir kaynak bulunamadı.
      </div>
    );
  }

  return (
    <div
      className="w-full relative"
      style={cueStyle}
      onMouseMove={showOverlayControls}
      onMouseEnter={showOverlayControls}
      onTouchStart={showOverlayControls}
      onMouseLeave={hideOverlayControls}
    >
      <MediaPlayer
        ref={playerRef}
        title={title}
        src={{ src: active.url, type: detectType(active.url, active.type) }}
        crossOrigin
        playsInline
        aspectRatio="16/9"
        volume={volume}
        onVolumeChange={(detail) => {
          cancelOutroAutoAdvance();
          localStorage.setItem(VOLUME_STORAGE_KEY, String(detail.volume));
          setVolume(detail.volume);
        }}
        onCanPlay={onCanPlay}
        onTimeUpdate={onTU}
        onEnded={() => {
          cancelOutroAutoAdvance();
          onEnded?.();
        }}
        onPlay={() => {
          cancelOutroAutoAdvance();
          onPlay?.();
        }}
        onPause={() => {
          cancelOutroAutoAdvance();
          onPause?.();
        }}
        onSeeked={() => {
          cancelOutroAutoAdvance();
          if (!onSeeked) return;
          const t = playerRef.current?.currentTime ?? 0;
          onSeeked(t);
        }}
        className="anizium-player w-full overflow-hidden rounded-xl border border-[var(--border)] bg-black"
      >
        <MediaProvider>
          {poster && <Poster className="vds-poster" src={poster} alt={title} />}
          {resolvedSubtitles.map((sub, i) => (
            <Track
              key={`${sub.name}-${i}`}
              src={sub.link}
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
          noGestures={isTouchDevice}
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
        <FullscreenResumeBridge playerRef={playerRef} pendingRef={fullscreenResumePendingRef} />
        {overlayTopRight && controlsVisible && (
          <div className={cn("absolute left-3 top-3 z-[60] max-w-[min(88vw,320px)] transition-opacity duration-200 opacity-100")}>
            {overlayTopRight}
          </div>
        )}
        {overlayPersistentTopRight && (
          <div className={cn("absolute left-3 top-3 z-[61] max-w-[min(88vw,320px)] transition-opacity duration-200 opacity-100")}>
            {overlayPersistentTopRight}
          </div>
        )}
        {overlayRightRail && (
          <div className="absolute bottom-20 right-3 z-[55] hidden max-h-[65%] w-[min(35vw,360px)] overflow-hidden md:block">
            {overlayRightRail}
          </div>
        )}
        {/* Intro Skip Overlay */}
        {showIntroSkip && (
          <button
            onClick={skipIntro}
            className="absolute bottom-18 right-4 z-50 flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg transition-opacity hover:opacity-90"
            aria-label="Intro&apos;yu atla"
          >
            <SkipForward className="h-4 w-4" /> Intro&apos;yu Atla
          </button>
        )}
        {/* Outro / Next Episode Overlay */}
        {showOutroSkip && (nextEpisodeHref || onNextEpisode) && (
          <button
            type="button"
            onClick={goNextEpisode}
            className="group absolute bottom-16 right-4 z-50 overflow-hidden rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg transition-all duration-300 hover:scale-[1.02] hover:opacity-95 animate-in fade-in slide-in-from-bottom-2"
            aria-label="Sonraki bölüme geç"
          >
            <span
              className="absolute inset-x-0 bottom-0 h-1 origin-left bg-white/35 transition-transform duration-1000 ease-linear"
              style={outroBarStyle}
            />
            <span className="relative z-10 flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                Sonraki Bölüm
                <SkipForward className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        )}
        <MobileSeekOverlay playerRef={playerRef} />
        <GestureHint />
      </MediaPlayer>
    </div>
  );
}

export default AnimePlayer;

function FullscreenResumeBridge({
  playerRef,
  pendingRef,
}: {
  playerRef: React.RefObject<MediaPlayerInstance | null>;
  pendingRef: MutableRefObject<boolean>;
}) {
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !pendingRef.current) return;
    pendingRef.current = false;
    queueMicrotask(() => {
      try {
        void p.enterFullscreen?.();
      } catch {}
    });
  }, [pendingRef, playerRef]);

  return null;
}
