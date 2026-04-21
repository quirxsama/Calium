"use client";
import { useCallback, useRef, useState } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { cn } from "@/lib/utils";

const SEEK_SECONDS = 10;
const DOUBLE_TAP_MS = 300;

type RippleState = {
  side: "left" | "right";
  seconds: number;
  key: number;
};

type Props = {
  playerRef: React.RefObject<MediaPlayerInstance | null>;
};

export function MobileSeekOverlay({ playerRef }: Props) {
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ripple, setRipple] = useState<RippleState | null>(null);
  const keyRef = useRef(0);

  const toggleControls = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.controls.showing) {
      p.controls.hide();
    } else {
      p.controls.show();
    }
  }, [playerRef]);

  const handleSeek = useCallback(
    (side: "left" | "right") => {
      const p = playerRef.current;
      if (!p) return;
      const delta = side === "right" ? SEEK_SECONDS : -SEEK_SECONDS;
      const newTime = Math.max(0, Math.min(p.state.duration, p.currentTime + delta));
      p.currentTime = newTime;

      accumulatedRef.current += SEEK_SECONDS;

      keyRef.current += 1;
      setRipple({ side, seconds: accumulatedRef.current, key: keyRef.current });

      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setRipple(null);
        accumulatedRef.current = 0;
      }, 700);
    },
    [playerRef]
  );

  const onTouchEnd = useCallback(
    (side: "left" | "right") => {
      const now = Date.now();
      const last = lastTapRef.current;

      if (last && last.side === side && now - last.time < DOUBLE_TAP_MS) {
        // Double tap — cancel pending single-tap toggle and seek
        lastTapRef.current = null;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        handleSeek(side);
      } else {
        // First tap — schedule controls toggle; will be cancelled if double-tap follows
        lastTapRef.current = { time: now, side };
        if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = setTimeout(() => {
          singleTapTimerRef.current = null;
          toggleControls();
        }, DOUBLE_TAP_MS);
      }
    },
    [handleSeek, toggleControls]
  );

  return (
    <div className="absolute inset-0 z-20 flex pointer-events-none">
      {/* Left zone — rewind (touch devices only) */}
      <div
        className="h-full w-1/2 seek-touch-zone"
        onTouchEnd={(e) => {
          e.stopPropagation();
          onTouchEnd("left");
        }}
      />
      {/* Right zone — forward (touch devices only) */}
      <div
        className="h-full w-1/2 seek-touch-zone"
        onTouchEnd={(e) => {
          e.stopPropagation();
          onTouchEnd("right");
        }}
      />

      {/* Ripple animation overlay */}
      {ripple && (
        <div
          key={ripple.key}
          className={cn(
            "absolute top-0 bottom-0 flex items-center justify-center pointer-events-none",
            ripple.side === "left" ? "left-0 w-1/3" : "right-0 w-1/3"
          )}
        >
          <div className="seek-ripple-bg absolute inset-0" />
          <div className="relative flex flex-col items-center gap-1 text-white seek-ripple-content">
            <div className="flex items-center gap-0.5">
              {ripple.side === "left" ? (
                <>
                  <SeekArrows direction="left" />
                </>
              ) : (
                <>
                  <SeekArrows direction="right" />
                </>
              )}
            </div>
            <span className="text-sm font-semibold">{ripple.seconds} saniye</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SeekArrows({ direction }: { direction: "left" | "right" }) {
  const arrow = direction === "right" ? "▶" : "◀";
  return (
    <span className="flex items-center gap-px text-2xl opacity-90">
      <span className="seek-arrow-1">{arrow}</span>
      <span className="seek-arrow-2">{arrow}</span>
      <span className="seek-arrow-3">{arrow}</span>
    </span>
  );
}
