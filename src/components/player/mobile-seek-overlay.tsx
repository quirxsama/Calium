"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const accumulatedRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ripple, setRipple] = useState<RippleState | null>(null);
  const keyRef = useRef(0);

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

  // Attach touch listener directly on the player element so Vidstack
  // continues to receive all single-tap events (play/pause, show controls).
  // We only intercept double-taps for seeking.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const el = p.el;
    if (!el) return;

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const onTouch = (e: TouchEvent) => {
      // Don't intercept taps on interactive controls
      const target = e.target as HTMLElement;
      if (
        target?.closest(
          'button, [role="button"], [role="slider"], [role="menuitem"], [role="menu"], input, a, .vds-controls, .vds-menu'
        )
      ) {
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";

      const now = Date.now();
      const last = lastTapRef.current;

      if (last && last.side === side && now - last.time < DOUBLE_TAP_MS) {
        // Double tap — seek
        lastTapRef.current = null;
        handleSeek(side);
      } else {
        // First tap — just record; let Vidstack handle it natively
        lastTapRef.current = { time: now, side };
      }
    };

    el.addEventListener("touchend", onTouch, { passive: true });
    return () => el.removeEventListener("touchend", onTouch);
  }, [playerRef, handleSeek]);

  return (
    <div className="absolute inset-0 z-20 flex pointer-events-none">
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
                <SeekArrows direction="left" />
              ) : (
                <SeekArrows direction="right" />
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
