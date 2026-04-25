"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import { cn } from "@/lib/utils";

const SEEK_SECONDS = 10;
const DOUBLE_TAP_MS = 450;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 14;

type RippleState = {
  side: "left" | "right";
  seconds: number;
  key: number;
};

type Props = {
  playerRef: React.RefObject<MediaPlayerInstance | null>;
  controlsVisible: boolean;
  onSingleTap: () => void;
  isInteractiveTarget: (target: EventTarget | null) => boolean;
};

export function MobileSeekOverlay({ playerRef, controlsVisible, onSingleTap, isInteractiveTarget }: Props) {
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const accumulatedRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressActiveRef = useRef(false);
  const previousPlaybackRateRef = useRef<number | null>(null);
  const [ripple, setRipple] = useState<RippleState | null>(null);
  const [speedBoostActive, setSpeedBoostActive] = useState(false);
  const keyRef = useRef(0);
  const suppressNativeDoubleTapRef = useRef(false);
  const suppressNativeTapUntilRef = useRef(0);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startSpeedBoost = useCallback(() => {
    const p = playerRef.current;
    if (!p || longPressActiveRef.current) return;

    const currentRate = Number.isFinite(p.playbackRate) ? p.playbackRate : 1;
    previousPlaybackRateRef.current = currentRate;
    p.playbackRate = 2;
    longPressActiveRef.current = true;
    suppressNativeTapUntilRef.current = Date.now() + DOUBLE_TAP_MS;
    lastTapRef.current = null;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    setSpeedBoostActive(true);
  }, [playerRef]);

  const stopSpeedBoost = useCallback(() => {
    if (!longPressActiveRef.current) return;

    const p = playerRef.current;
    const previousRate = previousPlaybackRateRef.current ?? 1;
    if (p) p.playbackRate = previousRate;

    previousPlaybackRateRef.current = null;
    longPressActiveRef.current = false;
    setSpeedBoostActive(false);
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

    const onTouchStart = (e: TouchEvent) => {
      // Don't intercept taps on interactive controls
      if (isInteractiveTarget(e.target)) {
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch || e.touches.length !== 1) return;

      e.preventDefault();
      e.stopPropagation();

      clearLongPressTimer();
      longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        startSpeedBoost();
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = longPressStartRef.current;
      const touch = e.changedTouches[0];
      if (!start || !touch || longPressActiveRef.current) return;

      const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
      if (moved > LONG_PRESS_MOVE_TOLERANCE) {
        clearLongPressTimer();
        longPressStartRef.current = null;
      }
    };

    const finishLongPress = (e: TouchEvent) => {
      clearLongPressTimer();
      longPressStartRef.current = null;

      if (!longPressActiveRef.current) return false;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      suppressNativeTapUntilRef.current = Date.now() + DOUBLE_TAP_MS;
      stopSpeedBoost();
      return true;
    };

    const onTouchCancel = (e: TouchEvent) => {
      finishLongPress(e);
    };

    const onTouch = (e: TouchEvent) => {
      if (finishLongPress(e)) return;

      // Don't intercept taps on interactive controls
      if (isInteractiveTarget(e.target)) {
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
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }

        lastTapRef.current = null;
        suppressNativeDoubleTapRef.current = true;
        suppressNativeTapUntilRef.current = Date.now() + DOUBLE_TAP_MS;
        e.preventDefault();
        e.stopPropagation();
        handleSeek(side);

        window.setTimeout(() => {
          suppressNativeDoubleTapRef.current = false;
        }, DOUBLE_TAP_MS);
      } else {
        lastTapRef.current = { time: now, side };

        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
        }

        e.preventDefault();
        e.stopPropagation();
        suppressNativeTapUntilRef.current = Date.now() + DOUBLE_TAP_MS;
        singleTapTimerRef.current = setTimeout(() => {
          lastTapRef.current = null;
          singleTapTimerRef.current = null;
          onSingleTap();
        }, DOUBLE_TAP_MS);
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      if (!suppressNativeDoubleTapRef.current) return;

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

    const onContextMenu = (e: Event) => {
      if (isInteractiveTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      if ("stopImmediatePropagation" in e && typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
    };

    const onPointerLike = (e: Event) => {
      if (Date.now() > suppressNativeTapUntilRef.current) return;
      if (isInteractiveTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      if ("stopImmediatePropagation" in e && typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    el.addEventListener("touchend", onTouch, { passive: false, capture: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: false, capture: true });
    el.addEventListener("contextmenu", onContextMenu, true);
    el.addEventListener("click", onPointerLike, true);
    el.addEventListener("pointerup", onPointerLike, true);
    el.addEventListener("dblclick", onDoubleClick, true);

    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      clearLongPressTimer();
      stopSpeedBoost();
      el.removeEventListener("touchstart", onTouchStart, true);
      el.removeEventListener("touchmove", onTouchMove, true);
      el.removeEventListener("touchend", onTouch, true);
      el.removeEventListener("touchcancel", onTouchCancel, true);
      el.removeEventListener("contextmenu", onContextMenu, true);
      el.removeEventListener("click", onPointerLike, true);
      el.removeEventListener("pointerup", onPointerLike, true);
      el.removeEventListener("dblclick", onDoubleClick, true);
    };
  }, [clearLongPressTimer, controlsVisible, handleSeek, isInteractiveTarget, onSingleTap, playerRef, startSpeedBoost, stopSpeedBoost]);

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
      {speedBoostActive && (
        <div className="absolute inset-x-0 top-5 z-30 flex justify-center pointer-events-none">
          <div className="speed-boost-pill rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/15 backdrop-blur">
            2x hız
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
