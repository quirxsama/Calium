import type { SubtitleData } from "@/lib/anizium/schemas";
import {
  saveOfflineEpisode,
  offlineEpisodeKey,
  type OfflineSubtitle,
} from "./offline-episodes";

const QUEUE_KEY = "calium:download-queue";
const MAX_CONCURRENT = 2;

export type DownloadQueueItem = {
  id: string;
  animeId: string;
  animeName: string;
  poster: string | null;
  episodeId: string;
  episodeName: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  videoUrl: string;
  videoType: string;
  quality: string | null;
  dubLabel: string | null;
  subtitles: SubtitleData[];
  selectedSubs: number[];
  status: "queued" | "downloading" | "done" | "error";
  progress: number;
  error?: string;
  totalBytes: number;
  addedAt: number;
};

export type DownloadQueueState = {
  items: DownloadQueueItem[];
};

function isSrt(url: string): boolean {
  return /\.srt(\?|$)/i.test(url);
}

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, "")
    .replace(/^\uFEFF/, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body.trim()}\n`;
}

function readQueue(): DownloadQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as DownloadQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: DownloadQueueItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("calium:download-queue-changed"));
}

export function getDownloadQueue(): DownloadQueueItem[] {
  return readQueue();
}

export function enqueueDownload(item: Omit<DownloadQueueItem, "status" | "progress" | "totalBytes" | "addedAt" | "id"> & { id?: string }) {
  const queue = readQueue();
  const id = item.id ?? offlineEpisodeKey(item.animeId, item.episodeId, item.quality, item.dubLabel);

  const existing = queue.find((q) => q.id === id);
  if (existing && (existing.status === "queued" || existing.status === "downloading")) return id;

  const newItem: DownloadQueueItem = {
    ...item,
    id,
    status: "queued",
    progress: 0,
    totalBytes: 0,
    addedAt: Date.now(),
  };

  queue.push(newItem);
  writeQueue(queue);

  requestPersistentStorage();

  return id;
}

export function removeFromQueue(id: string) {
  const queue = readQueue().filter((q) => q.id !== id);
  writeQueue(queue);
}

export function updateQueueItem(id: string, patch: Partial<DownloadQueueItem>) {
  const queue = readQueue();
  const idx = queue.findIndex((q) => q.id === id);
  if (idx < 0) return;
  queue[idx] = { ...queue[idx], ...patch };
  writeQueue(queue);
}

const activeControllers = new Map<string, AbortController>();

export function startQueueProcessing() {
  const processNext = () => {
    const queue = readQueue();
    const downloading = queue.filter((q) => q.status === "downloading").length;
    if (downloading >= MAX_CONCURRENT) return;

    const next = queue.find((q) => q.status === "queued");
    if (!next) return;

    processDownload(next);
  };

  processNext();
}

async function processDownload(item: DownloadQueueItem) {
  const ctrl = new AbortController();
  activeControllers.set(item.id, ctrl);

  updateQueueItem(item.id, { status: "downloading", progress: 0 });

  try {
    const totalSteps = 1 + item.subtitles.length;
    let completedSteps = 0;

    const updateProgress = (step: number) => {
      completedSteps = step;
      updateQueueItem(item.id, {
        progress: Math.round((completedSteps / totalSteps) * 100),
      });
    };

    const videoRes = await fetch(item.videoUrl, { signal: ctrl.signal });
    if (!videoRes.ok) throw new Error(`Video indirilemedi: ${videoRes.status}`);
    const videoBlob = await videoRes.blob();
    updateProgress(1);

    const downloadedSubs: OfflineSubtitle[] = [];
    for (const [i, sub] of item.subtitles.entries()) {
      if (!item.selectedSubs.includes(i) || ctrl.signal.aborted) continue;
      try {
        const res = await fetch(sub.link, { signal: ctrl.signal });
        if (!res.ok) continue;
        const text = await res.text();
        const vttText = isSrt(sub.link) ? srtToVtt(text) : text;
        const vttBlob = new Blob([vttText], { type: "text/vtt" });
        const isTr = sub.name.toLowerCase().includes("tur") || sub.name.toLowerCase().includes("türk");
        downloadedSubs.push({
          name: sub.name,
          language: isTr ? "tr" : sub.name.toLowerCase().includes("eng") ? "en" : null,
          vttBlob,
        });
      } catch {}
      updateProgress(1 + i + 1);
    }

    if (ctrl.signal.aborted) return;

    const totalBytes = videoBlob.size + downloadedSubs.reduce((acc, s) => acc + s.vttBlob.size, 0);

    await saveOfflineEpisode({
      id: item.id,
      animeId: item.animeId,
      animeName: item.animeName,
      poster: item.poster,
      episodeId: item.episodeId,
      episodeName: item.episodeName,
      episodeNumber: item.episodeNumber,
      seasonNumber: item.seasonNumber,
      videoBlob,
      videoType: videoBlob.type || item.videoType || "video/mp4",
      videoUrl: item.videoUrl,
      quality: item.quality,
      dubLabel: item.dubLabel,
      subtitles: downloadedSubs,
      downloadedAt: Date.now(),
      totalBytes,
    });

    updateQueueItem(item.id, { status: "done", progress: 100, totalBytes });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    updateQueueItem(item.id, {
      status: "error",
      error: (e as Error).message ?? "Bilinmeyen hata",
    });
  } finally {
    activeControllers.delete(item.id);
    startQueueProcessing();
  }
}

export function cancelDownload(id: string) {
  const ctrl = activeControllers.get(id);
  if (ctrl) {
    ctrl.abort();
    activeControllers.delete(id);
  }
  removeFromQueue(id);
}

export function clearCompletedDownloads() {
  const queue = readQueue().filter((q) => q.status !== "done" && q.status !== "error");
  writeQueue(queue);
}

export function resumeQueue() {
  startQueueProcessing();
  const queue = readQueue();
  for (const item of queue) {
    if (item.status === "downloading") {
      updateQueueItem(item.id, { status: "queued", progress: 0 });
    }
  }
}

async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !("storage" in navigator)) return;
  try {
    const persisted = await navigator.storage.persisted();
    if (persisted) return;
    await navigator.storage.persist();
  } catch {}
}

export function requestPersistentStoragePermission(): Promise<boolean> {
  return navigator.storage?.persist?.() ?? Promise.resolve(false);
}
