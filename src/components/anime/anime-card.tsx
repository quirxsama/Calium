import Link from "next/link";
import { AniziumImage } from "./anizium-image";
import { Play, Star } from "lucide-react";
import { cn, formatAnimeType } from "@/lib/utils";

type Props = {
  id: string;
  name: string;
  poster?: string | null;
  imdb?: number | string | null;
  badge?: string;
  className?: string;
  type?: string | null;
};

export function AnimeCard({ id, name, poster, imdb, badge, className, type }: Props) {
  const href = `/anime/${encodeURIComponent(id)}`;
  const rating = typeof imdb === "number" ? imdb : imdb ? Number(imdb) : null;

  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300 ease-out",
        "hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[var(--primary)]/10 hover:border-[var(--primary)]/60 active:scale-[0.97] touch-none-callout",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        className
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--muted)]">
        {poster ? (
          <AniziumImage
            src={poster}
            alt={name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 200px"
            className="object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.08]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
            Poster yok
          </div>
        )}
        {badge && (
          <div className="absolute left-2 top-2 rounded-md bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--primary-foreground)]">
            {badge}
          </div>
        )}
        {rating && rating > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white backdrop-blur-sm">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)}
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="mb-4 inline-flex translate-y-2 items-center gap-1.5 rounded-full bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/30 transition-transform duration-300 group-hover:translate-y-0">
            <Play className="h-3 w-3 fill-current" />
            İzle
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight transition-colors group-hover:text-[var(--primary)]">{name}</h3>
        <p className="mt-1 min-h-[1rem] text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] line-clamp-1">
          {formatAnimeType(type) || "\u00a0"}
        </p>
      </div>
    </Link>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="skeleton aspect-[2/3] w-full" />
      <div className="p-2.5 space-y-1.5">
        <div className="skeleton h-3.5 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
