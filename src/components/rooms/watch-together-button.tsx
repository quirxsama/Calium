"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/context";

type Props = {
  animeId: string;
  animeName: string;
  episodeId: string;
  episodeName?: string | null;
  poster?: string | null;
  className?: string;
};

/** Watch Together odası oluşturur ve /oda/[id]'ye yönlendirir. */
export function WatchTogetherButton({
  animeId,
  animeName,
  episodeId,
  episodeName,
  poster,
  className,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  async function createRoom() {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId,
          animeName,
          episodeId,
          episodeName: episodeName ?? null,
          poster: poster ?? null,
          isPublic: false,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        router.push(`/oda/${data.room.id}`);
      } else {
        alert(data.error ?? "Oda oluşturulamadı.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={createRoom}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/15 disabled:opacity-60"
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users2 className="h-3.5 w-3.5" />}
      Arkadaşlarla İzle
    </button>
  );
}
