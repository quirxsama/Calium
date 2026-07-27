"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ChevronUp, Loader2, X, XCircle } from "lucide-react";
import { useDownloadQueue } from "@/hooks/use-download-queue";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function DownloadQueueBar() {
  const { queue, cancel, clearCompleted } = useDownloadQueue();
  const [expanded, setExpanded] = useState(false);

  const activeItems = useMemo(
    () => queue.filter((q) => q.status === "queued" || q.status === "downloading"),
    [queue]
  );

  const completedCount = useMemo(
    () => queue.filter((q) => q.status === "done").length,
    [queue]
  );

  const handleClearCompleted = useCallback(() => {
    clearCompleted();
  }, [clearCompleted]);

  if (activeItems.length === 0 && completedCount === 0) return null;

  return (
    <div className="fixed bottom-16 right-0 left-0 z-[100] flex justify-center px-2 md:bottom-4 md:right-4 md:left-auto md:justify-end md:px-0">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)]/96 shadow-2xl backdrop-blur transition-all",
          expanded ? "p-3" : "p-2"
        )}
      >
        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex w-full items-center gap-3 px-2"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)] shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold">
                {activeItems.length > 0
                  ? `${activeItems.length} bölüm indiriliyor`
                  : `${completedCount} bölüm indirildi`}
              </p>
              {activeItems.length > 0 && (
                <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                  {activeItems[0].animeName} · {activeItems[0].episodeName}
                </p>
              )}
            </div>
            <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-semibold">İndirme Kuyruğu</h3>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[40vh] overflow-y-auto space-y-2">
              {queue.filter((q) => q.status !== "done").map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{item.animeName}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] line-clamp-1">
                      {item.episodeName}
                      {item.quality ? ` · ${item.quality}` : ""}
                      {item.dubLabel ? ` · ${item.dubLabel}` : ""}
                    </p>
                    {item.status === "downloading" && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === "error" && (
                      <p className="text-[10px] text-red-500 mt-0.5">{item.error}</p>
                    )}
                    {item.status === "queued" && (
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Sırada bekliyor</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => cancel(item.id)}
                    className="rounded-full p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 shrink-0"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {queue.filter((q) => q.status === "done").slice(0, expanded ? undefined : 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-2"
                >
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{item.animeName}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] line-clamp-1">
                      {item.episodeName} · İndirildi
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {completedCount > 0 && (
              <div className="mt-2 flex items-center justify-between px-1">
                <Link
                  href="/indirilenler"
                  className="text-[11px] font-medium text-[var(--primary)] hover:underline"
                >
                  İndirilenleri gör
                </Link>
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Tamamlananları temizle
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
