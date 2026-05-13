"use client";

import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { AniziumImage } from "./anizium-image";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^?&/]+)/
  );
  return match ? match[1] : null;
}

type Props = {
  poster: string | null;
  youtubeUrl: string | null;
  alt: string;
  className?: string;
};

export function AnimePosterFlip({ poster, youtubeUrl, alt, className }: Props) {
  const [showVideo, setShowVideo] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const controls = useAnimation();

  const videoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;
  if (!videoId) return null;

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&vq=hd1080`;

  const flipToVideo = async () => {
    if (isAnimating) return;
    setIsAnimating(true);

    await controls.start({
      rotateY: 90,
      transition: { duration: 0.3, ease: "easeIn" },
    });

    setShowVideo(true);
    controls.set({ rotateY: -90 });

    await controls.start({
      rotateY: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    });

    setIsAnimating(false);
  };

  const flipToPoster = async () => {
    if (isAnimating) return;
    setIsAnimating(true);

    await controls.start({
      rotateY: 90,
      transition: { duration: 0.3, ease: "easeIn" },
    });

    setShowVideo(false);
    controls.set({ rotateY: -90 });

    await controls.start({
      rotateY: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    });

    setIsAnimating(false);
  };

  return (
    <div
      className={cn(
        "relative shrink-0 transition-all duration-500 ease-in-out",
        className,
        showVideo ? "w-[300px]" : "w-[160px] md:w-[224px]"
      )}
      style={{ perspective: 1000 }}
    >
      <motion.div animate={controls} style={{ transformStyle: "preserve-3d" }}>
        {!showVideo ? (
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
            {poster ? (
              <AniziumImage
                src={poster}
                alt={alt}
                fill
                sizes="240px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
                Poster yok
              </div>
            )}
            <button
              onClick={flipToVideo}
              disabled={isAnimating}
              aria-label="Fragmanı oynat"
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
          </div>
        ) : (
          <div className="relative h-[200px] w-[300px] overflow-hidden rounded-xl border border-[var(--border)] bg-black shadow-lg">
            <iframe
              src={embedUrl}
              title="Fragman"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
            <button
              onClick={flipToPoster}
              disabled={isAnimating}
              aria-label="Posteri göster"
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
