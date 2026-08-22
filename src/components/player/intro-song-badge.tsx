"use client";

import React, { useState } from "react";
import { Music, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type IntroSongData = {
  title: string;
  artist: string;
  coverUrl?: string | null;
  spotifyUrl: string;
};

type Props = {
  song: IntroSongData | null;
  visible: boolean;
  isFadingOut?: boolean;
};

export function IntroSongBadge({ song, visible, isFadingOut = false }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!song || dismissed) return null;

  return (
    <div
      className={cn(
        "absolute bottom-18 left-4 z-50 flex max-w-[min(85vw,320px)] items-center gap-2.5 rounded-xl border border-white/15 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-md transition-all duration-700 ease-out sm:bottom-20 sm:p-2.5",
        visible && !isFadingOut
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "translate-y-2 opacity-0 pointer-events-none"
      )}
      role="region"
      aria-label="İntro Şarkı Bilgisi"
    >
      {/* Kapak Görseli */}
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-800 shadow-md sm:h-12 sm:w-12">
        {song.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={song.coverUrl}
            alt={song.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <Music className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Şarkı ve Sanatçı Bilgisi */}
      <a
        href={song.spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group min-w-0 flex-1 cursor-pointer focus:outline-none"
        title="Spotify'da Dinle"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#1DB954] sm:text-[11px]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1DB954]" />
          <span>İntro Şarkısı</span>
        </div>
        <p className="truncate text-xs font-semibold text-white transition-colors group-hover:text-[#1DB954] sm:text-sm">
          {song.title}
        </p>
        <p className="truncate text-[11px] text-neutral-300 sm:text-xs">
          {song.artist}
        </p>
      </a>

      {/* Spotify Butonu */}
      <a
        href={song.spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1DB954]/15 text-[#1DB954] transition-transform hover:scale-110 hover:bg-[#1DB954] hover:text-black focus:outline-none"
        aria-label="Spotify'da Dinle"
        title="Spotify'da Dinle"
      >
        <SpotifyIcon className="h-4 w-4" />
      </a>

      {/* Kapat butonu */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="text-neutral-400 hover:text-white p-0.5 rounded transition-colors"
        aria-label="Gizle"
        title="Gizle"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.31c-.216.353-.675.467-1.028.25-2.813-1.718-6.352-2.107-10.524-1.155-.403.093-.805-.16-.897-.563-.093-.404.16-.805.563-.898 4.567-1.042 8.487-.597 11.636 1.338.353.216.467.675.25 1.028zm1.47-3.26c-.272.443-.852.585-1.295.312-3.22-1.98-8.128-2.55-11.936-1.393-.497.15-1.025-.133-1.176-.63-.15-.497.133-1.025.63-1.176 4.354-1.321 9.774-.683 13.465 1.592.443.272.585.852.312 1.295zm.126-3.41c-3.86-2.292-10.224-2.504-13.886-1.392-.593.18-1.22-.16-1.4-.753-.18-.593.16-1.22.753-1.4 4.218-1.28 11.248-1.034 15.688 1.602.533.316.707 1.008.39 1.542-.315.534-1.008.708-1.545.391z" />
    </svg>
  );
}
