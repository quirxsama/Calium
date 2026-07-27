"use client";

import { useCallback, useEffect, useState } from "react";
import type { DownloadQueueItem } from "@/lib/storage/download-queue";
import {
  getDownloadQueue,
  enqueueDownload,
  cancelDownload,
  clearCompletedDownloads,
  resumeQueue,
} from "@/lib/storage/download-queue";

export function useDownloadQueue() {
  const [queue, setQueue] = useState<DownloadQueueItem[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setQueue(getDownloadQueue());
      resumeQueue();
    });

    const handler = () => {
      setQueue(getDownloadQueue());
    };

    window.addEventListener("calium:download-queue-changed", handler);
    return () => {
      window.removeEventListener("calium:download-queue-changed", handler);
    };
  }, []);

  const enqueue = useCallback(
    (item: Parameters<typeof enqueueDownload>[0]) => enqueueDownload(item),
    []
  );

  const cancel = useCallback((id: string) => cancelDownload(id), []);
  const clearCompleted = useCallback(() => clearCompletedDownloads(), []);

  return { queue, enqueue, cancel, clearCompleted };
}
