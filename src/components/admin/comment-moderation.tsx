"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { AdminCommentItem } from "@/lib/comments/types";

type Data = {
  comments: AdminCommentItem[];
  nextCursor: string | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminCommentModeration() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/comments?${params}`);
      const json = await res.json();
      if (!json.success) {
        toast(json.error ?? "Yorumlar yüklenemedi", "error");
        return;
      }
      const incoming = json.data as Data;
      setData((prev) =>
        cursor && prev
          ? { comments: [...prev.comments, ...incoming.comments], nextCursor: incoming.nextCursor }
          : incoming
      );
    } catch {
      toast("Yorumlar yüklenemedi", "error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function remove(comment: AdminCommentItem) {
    const ok = await confirm({
      title: "Yorumu kaldır",
      description: `@${comment.user.username} kullanıcısının yorumu yayından kaldırılacak.`,
      confirmText: "Kaldır",
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(comment.id);
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast(json.error ?? "Yorum kaldırılamadı", "error");
        return;
      }
      setData((prev) =>
        prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== comment.id) } : prev
      );
      toast("Yorum kaldırıldı", "success");
    } catch {
      toast("Yorum kaldırılamadı", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Moderasyon</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Seri ve bölüm yorumlarını incele, uygunsuz olanları yayından kaldır.
        </p>
      </div>

      {data && (
        <p className="text-xs text-[var(--muted-foreground)]">
          {data.comments.length} yorum listeleniyor
        </p>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Yorum</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Yazan</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Yer</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Tarih</th>
              <th className="px-4 py-2.5 text-right font-medium text-[var(--muted-foreground)]">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="skeleton h-4 w-full rounded" />
                  </td>
                </tr>
              ))
            ) : data?.comments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-foreground)]">
                  <MessageSquare className="mx-auto mb-2 h-6 w-6" />
                  Henüz yorum yok.
                </td>
              </tr>
            ) : (
              data?.comments.map((comment) => (
                <tr key={comment.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 max-w-[380px]">
                    <p className="whitespace-pre-wrap break-words line-clamp-3">{comment.body}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/profil/${encodeURIComponent(comment.user.username)}`}
                      className="font-medium hover:text-[var(--primary)]"
                    >
                      @{comment.user.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {comment.episodeId ? "Bölüm" : "Seri"}
                    </span>
                    <Link
                      href={`/anime/${encodeURIComponent(comment.animeId)}`}
                      target="_blank"
                      className="ml-2 inline-flex items-center gap-1 text-xs hover:text-[var(--primary)]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Animeye git
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--muted-foreground)]">
                    {formatDate(comment.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void remove(comment)}
                      disabled={deletingId === comment.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Kaldır
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void load(data.nextCursor ?? undefined)}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Daha fazla yorum
          </button>
        </div>
      )}
    </div>
  );
}
