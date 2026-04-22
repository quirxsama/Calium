"use client";

import { useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import type { TMDBCast } from "@/lib/anizium/schemas";

function CastCard({ person }: { person: TMDBCast }) {
  const imgSrc = person.profile_path
    ? `https://image.tmdb.org/t/p/w200${person.profile_path}`
    : null;

  return (
    <div className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center transition hover:border-[var(--primary)]/40 hover:shadow-md">
      <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[var(--muted)]">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={person.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--muted-foreground)]">
            <User className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight text-[var(--foreground)] line-clamp-2">
          {person.name}
        </p>
        <p className="mt-0.5 text-[10px] leading-tight text-[var(--muted-foreground)] line-clamp-2">
          {person.character}
        </p>
      </div>
    </div>
  );
}

type Props = {
  cast: TMDBCast[];
  title?: string;
};

export function CastSection({ cast, title = "Seslendirme Kadrosu" }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (!cast || cast.length === 0) return null;

  const display = showAll ? cast : cast.slice(0, 10);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight md:text-2xl">{title}</h2>
        {cast.length > 10 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
          >
            {showAll ? "Daha Az Göster" : "Tümünü Gör"}
          </button>
        )}
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pb-3 -mx-1 px-1">
        {display.map((person) => (
          <CastCard key={person.id} person={person} />
        ))}
      </div>
    </section>
  );
}
