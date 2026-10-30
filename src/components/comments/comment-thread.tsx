"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, LogIn, MessageSquare, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  COMMENT_MAX_LENGTH,
  type CommentItem,
  type CommentListData,
} from "@/lib/comments/types";

const PAGE_SIZE = 20;
const NEAR_LIMIT = COMMENT_MAX_LENGTH - 200;

type CommentThreadProps = {
  animeId: string;
  episodeId?: string | null;
  heading?: string;
};

type CommentsResponse = {
  success?: boolean;
  data?: CommentListData;
  error?: string;
};

type CreateCommentResponse = {
  success?: boolean;
  data?: { comment: CommentItem };
  error?: string;
};

function buildQuery(animeId: string, episodeId: string | null, cursor?: string | null) {
  const params = new URLSearchParams({ animeId, limit: String(PAGE_SIZE) });
  if (episodeId) params.set("episodeId", episodeId);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

function formatRelativeTime(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || now <= 0) return "";
  const diff = now - date.getTime();
  if (diff < 60_000) return "az önce";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  if (hours < 48) return "dün";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase("tr-TR");
}

export function CommentThread({
  animeId,
  episodeId = null,
  heading = "Yorumlar",
}: CommentThreadProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const headingId = useId();
  const composerId = useId();
  const counterId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const postingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const deletingRef = useRef(false);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    async function load() {
      setLoading(true);
      setLoadError(false);
      setComments([]);
      setNextCursor(null);
      try {
        const res = await fetch(`/api/comments?${buildQuery(animeId, episodeId)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as CommentsResponse;
        if (!alive) return;
        if (!res.ok || !json.success || !json.data) {
          setLoadError(true);
          return;
        }
        const loaded = Array.isArray(json.data.comments) ? json.data.comments : [];
        // İlk yükleme sürerken gönderilen yorum varsa koru.
        setComments((prev) => {
          const seen = new Set(loaded.map((comment) => comment.id));
          return [...prev.filter((comment) => !seen.has(comment.id)), ...loaded];
        });
        setNextCursor(json.data.nextCursor ?? null);
        setNow(Date.now());
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
  }, [animeId, episodeId, reloadKey]);

  // Göreli zamanları dakikada bir tazele (sekme açıkken bayatlamasın).
  useEffect(() => {
    if (comments.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [comments.length]);

  // Textarea içeriğe göre büyüsün.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  async function loadMore() {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/comments?${buildQuery(animeId, episodeId, nextCursor)}`);
      const json = (await res.json()) as CommentsResponse;
      if (!res.ok || !json.success || !json.data) {
        toast("Daha fazla yorum yüklenemedi.", "error");
        return;
      }
      const incoming = Array.isArray(json.data.comments) ? json.data.comments : [];
      setComments((prev) => {
        const seen = new Set(prev.map((comment) => comment.id));
        return [...prev, ...incoming.filter((comment) => !seen.has(comment.id))];
      });
      setNextCursor(json.data.nextCursor ?? null);
      setNow(Date.now());
    } catch {
      toast("Daha fazla yorum yüklenemedi.", "error");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function submit() {
    const body = text.trim();
    if (!body || postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animeId,
          ...(episodeId ? { episodeId } : {}),
          body,
        }),
      });
      const json = (await res.json()) as CreateCommentResponse;
      if (res.status === 401) {
        toast("Yorum yapmak için giriş yapmalısın.", "error");
        return;
      }
      if (!res.ok || !json.success) {
        toast(json.error ?? "Yorum gönderilemedi.", "error");
        return;
      }
      if (!json.data?.comment) {
        toast("Yorum gönderilemedi.", "error");
        return;
      }
      const created = json.data.comment;
      setComments((prev) => [created, ...prev]);
      setNow(Date.now());
      setText("");
      toast("Yorumun paylaşıldı.", "success");
    } catch {
      toast("Yorum gönderilemedi.", "error");
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  async function remove(comment: CommentItem) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      const ok = await confirm({
        title: "Yorumu sil",
        description: "Bu işlem geri alınamaz.",
        confirmText: "Sil",
        cancelText: "Vazgeç",
        variant: "danger",
      });
      if (!ok) return;

      setDeletingId(comment.id);
      const res = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast(json.error ?? "Yorum silinemedi.", "error");
        return;
      }
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
      toast("Yorum silindi.", "success");
    } catch {
      toast("Yorum silinemedi.", "error");
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  const nearLimit = text.length >= NEAR_LIMIT;
  const canSubmit = text.trim().length > 0 && !posting;
  const counter = `${text.length}/${COMMENT_MAX_LENGTH}`;
  const placeholder = episodeId
    ? "Bu bölüm hakkında ne düşünüyorsun?"
    : "Bu seri hakkında ne düşünüyorsun?";

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={loading}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id={headingId}
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <MessageSquare className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          {heading}
        </h2>
        {!loading && !loadError && (
          <span
            className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--muted-foreground)]"
            aria-label={
              nextCursor
                ? `${comments.length} ve daha fazla yorum`
                : `${comments.length} yorum`
            }
          >
            {comments.length}
            {nextCursor ? "+" : ""}
          </span>
        )}
      </div>

      {authLoading ? (
        <div
          className="h-[124px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]/40"
          aria-hidden="true"
        />
      ) : !user ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-3 sm:p-4">
          <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
            Yorum yapmak için giriş yap
          </p>
          <Link
            href="/giris"
            className="inline-flex h-9 items-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
          >
            Giriş yap
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3 transition focus-within:border-[var(--primary)]/50 focus-within:bg-[var(--muted)]/50">
          <label htmlFor={composerId} className="sr-only">
            Yorum yaz
          </label>
          <textarea
            id={composerId}
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onComposerKeyDown}
            maxLength={COMMENT_MAX_LENGTH}
            rows={3}
            disabled={posting}
            placeholder={placeholder}
            aria-describedby={counterId}
            className="block w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span
              id={counterId}
              className={cn(
                "text-[11px] tabular-nums text-[var(--muted-foreground)]",
                nearLimit && "font-medium text-[var(--primary)]"
              )}
            >
              {counter}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              aria-label="Yorumu gönder"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Gönder
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div role="status">
          <span className="sr-only">Yorumlar yükleniyor</span>
          <div className="space-y-4" aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex animate-pulse gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--muted)]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-32 rounded bg-[var(--muted)]" />
                  <div className="h-3 w-full rounded bg-[var(--muted)]" />
                  <div className="h-3 w-2/3 rounded bg-[var(--muted)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/20 px-4 py-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Yorumlar yüklenemedi.</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-3 inline-flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            Tekrar dene
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
          <MessageSquare
            className="mx-auto h-6 w-6 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Henüz yorum yok — ilk yorumu sen yaz.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {comments.map((comment) => {
            const displayName = comment.user.displayName ?? comment.user.username;
            const profileHref = `/profil/${encodeURIComponent(comment.user.username)}`;
            return (
              <li key={comment.id} className="py-3.5 first:pt-0 last:pb-0">
                <article className="flex gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)] ring-1 ring-[var(--border)]"
                    aria-hidden="true"
                  >
                    {comment.user.avatarUrl ? (
                      <Image
                        src={comment.user.avatarUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-[var(--muted-foreground)]">
                        {initialOf(displayName)}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Link
                          href={profileHref}
                          className="truncate text-sm font-semibold transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
                        >
                          {displayName}
                        </Link>
                        <time
                          dateTime={comment.createdAt}
                          title={formatFullDate(comment.createdAt)}
                          className="text-[11px] text-[var(--muted-foreground)]"
                        >
                          {formatRelativeTime(comment.createdAt, now)}
                        </time>
                      </div>
                      {comment.canDelete && (
                        <button
                          type="button"
                          onClick={() => void remove(comment)}
                          disabled={deletingId !== null}
                          aria-label="Yorumu sil"
                          title="Yorumu sil"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] opacity-60 transition hover:bg-red-500/10 hover:text-red-400 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-40"
                        >
                          {deletingId === comment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]/90">
                      {comment.body}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !loadError && nextCursor && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium transition hover:border-[var(--primary)]/50 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Daha fazla yorum
          </button>
        </div>
      )}
    </section>
  );
}
