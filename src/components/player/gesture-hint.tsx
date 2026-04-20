"use client";
import { useEffect, useState } from "react";

const LS_KEY = "calium:gesture-hint-shown";

export function GestureHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only show on touch devices
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    if (localStorage.getItem(LS_KEY)) return;
    queueMicrotask(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(LS_KEY, "1");
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 gesture-hint-overlay pointer-events-none"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-4 text-white text-center px-6">
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1 text-2xl">
              <span>◀◀</span>
            </div>
            <span className="text-xs opacity-80">Çift dokun</span>
            <span className="text-sm font-semibold">10s Geri</span>
          </div>
          <div className="h-12 w-px bg-white/30" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1 text-2xl">
              <span>▶▶</span>
            </div>
            <span className="text-xs opacity-80">Çift dokun</span>
            <span className="text-sm font-semibold">10s İleri</span>
          </div>
        </div>
        <p className="text-xs opacity-60 mt-2">Bu ipucu yalnızca bir kez gösterilir</p>
      </div>
    </div>
  );
}
