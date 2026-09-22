"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/kesfet" }: { fallback?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Geri dön"
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-4 py-2 text-xs font-semibold text-[var(--foreground)] backdrop-blur-md shadow-lg transition hover:bg-[var(--card)] hover:scale-105 active:scale-95"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Geri</span>
    </button>
  );
}
