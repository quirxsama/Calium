"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { RatingSummary } from "@/lib/comments/types";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type RatingWidgetProps = {
  animeId: string;
  className?: string;
};

type RatingResponse = {
  success?: boolean;
  data?: RatingSummary;
  error?: string;
};

export function RatingWidget({ animeId, className }: RatingWidgetProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch(`/api/ratings/${encodeURIComponent(animeId)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as RatingResponse;
        if (!alive) return;
        if (!res.ok || !json.success || !json.data) {
          setLoadError(true);
          return;
        }
        setSummary({
          average: json.data.average ?? null,
          count: json.data.count ?? 0,
          myRating: json.data.myRating ?? null,
        });
      } catch (err) {
        if (!alive) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [animeId, reloadKey]);

  async function rate(value: number) {
    if (submitting !== null || authLoading) return;
    if (!user) {
      setNeedsAuth(true);
      toast("Puan vermek için giriş yapmalısın.", "error");
      router.push("/giris");
      return;
    }

    setSubmitting(value);
    try {
      const res = await fetch(`/api/ratings/${encodeURIComponent(animeId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const json = (await res.json()) as RatingResponse;
      if (res.status === 401) {
        setNeedsAuth(true);
        toast("Puan vermek için giriş yapmalısın.", "error");
        return;
      }
      if (!res.ok || !json.success || !json.data) {
        toast(json.error ?? "Puan kaydedilemedi.", "error");
        return;
      }
      setSummary({
        average: json.data.average ?? null,
        count: json.data.count ?? 0,
        myRating: json.data.myRating ?? value,
      });
      setNeedsAuth(false);
      toast("Puanın kaydedildi.", "success");
    } catch {
      toast("Puan kaydedilemedi.", "error");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-3 text-xs text-[var(--muted-foreground)]",
          className
        )}
        aria-busy="true"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span className="h-4 w-14 animate-pulse rounded bg-[var(--muted)]" />
        <span className="h-7 w-40 animate-pulse rounded-lg bg-[var(--muted)]" />
        <span className="sr-only">Puanlar yükleniyor</span>
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div
        className={cn(
          "inline-flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 text-xs text-[var(--muted-foreground)]",
          className
        )}
      >
        <Star className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Puanlar yüklenemedi.</span>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="font-medium text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const average = summary.average;
  const hasVotes = summary.count > 0 && average !== null;
  const averageText = average !== null ? average.toFixed(1) : "—";
  const countText = summary.count > 0 ? `(${summary.count} oy)` : "Henüz oy yok";
  const currentRating = summary.myRating;
  const previewValue = hovered ?? currentRating;
  const showLoginHint = needsAuth || (!authLoading && !user);
  const buttonsDisabled = authLoading || submitting !== null;

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 sm:inline-flex sm:w-auto",
        className
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Topluluk puanı
        </span>
        <span className="flex items-baseline gap-1">
          <Star
            className={cn(
              "h-3.5 w-3.5 translate-y-[-1px]",
              hasVotes
                ? "fill-yellow-400 text-yellow-400"
                : "text-[var(--muted-foreground)]"
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "text-xl font-bold leading-none tabular-nums",
              hasVotes ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
            )}
          >
            {averageText}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)]">/ 10</span>
          <span className="ml-0.5 text-[11px] text-[var(--muted-foreground)]">{countText}</span>
        </span>
      </div>

      <span className="hidden h-8 w-px bg-[var(--border)] sm:block" aria-hidden="true" />

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
        <div
          role="group"
          aria-label="Puan ver"
          className="inline-flex w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] sm:w-auto"
        >
          {SCORES.map((score) => {
            const selected = currentRating === score;
            const inPreview = !selected && previewValue !== null && score <= previewValue;
            const isSubmitting = submitting === score;
            return (
              <button
                key={score}
                type="button"
                onClick={() => void rate(score)}
                onMouseEnter={() => setHovered(score)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(score)}
                onBlur={() => setHovered(null)}
                disabled={buttonsDisabled}
                aria-label={`${score} / 10 puan ver`}
                aria-pressed={selected}
                title={`${score} puan`}
                className={cn(
                  "relative flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] text-[11px] font-semibold tabular-nums transition-colors last:border-r-0 sm:w-6 sm:flex-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]",
                  selected
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : inPreview
                      ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--primary)]/10 hover:text-[var(--foreground)]",
                  buttonsDisabled && "cursor-not-allowed opacity-70"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  score
                )}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] leading-none text-[var(--muted-foreground)]" aria-live="polite">
          {currentRating !== null ? (
            <>
              Senin puanın:{" "}
              <span className="font-semibold text-[var(--foreground)]">{currentRating}</span>
            </>
          ) : showLoginHint ? (
            <>
              Puan vermek için{" "}
              <Link
                href="/giris"
                className="font-medium text-[var(--primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                giriş yap
              </Link>
            </>
          ) : authLoading ? (
            "Yükleniyor…"
          ) : (
            "Puan vermek için bir sayı seç"
          )}
        </span>
      </div>
    </div>
  );
}
