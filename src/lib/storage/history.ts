export type HistoryEntry = {
  animeId: string;
  animeName: string;
  poster?: string | null;
  episodeId: string;
  episodeName: string;
  episodeNumber?: number | null;
  seasonNumber?: number | null;
  progress: number; // seconds
  duration: number; // seconds
  updatedAt: number;
};

export const FINISHED_EPISODE_REMAINING_SECONDS = 180;

export function isEpisodeFinished(progress: number, duration: number): boolean {
  if (duration <= 0) return false;
  return duration - progress <= FINISHED_EPISODE_REMAINING_SECONDS;
}

const KEY = "animes:history";
const DELETED_KEY = "animes:history-deleted";
const CLEAR_KEY = "animes:history-clear-requested-at";
const UPSERT_KEY = "animes:history-upserts";

function readStringArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

function queueHistoryDeletion(animeId: string) {
  if (typeof window === "undefined") return;
  if (hasPendingHistoryClear()) return;
  removePendingHistoryUpserts([animeId]);
  const deleted = new Set(readDeletedHistoryIds());
  deleted.add(animeId);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted]));
}

function queueHistoryUpsert(animeId: string) {
  if (typeof window === "undefined") return;
  if (hasPendingHistoryClear()) return;
  const upserts = new Set(readPendingHistoryUpsertIds());
  upserts.add(animeId);
  localStorage.setItem(UPSERT_KEY, JSON.stringify([...upserts]));
}

export function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function writeHistory(list: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  window.dispatchEvent(new CustomEvent("animes:history-changed"));
}

export function upsertHistory(entry: HistoryEntry) {
  const list = readHistory();
  const filtered = list.filter((e) => e.animeId !== entry.animeId);
  removeDeletedHistoryIds([entry.animeId]);
  queueHistoryUpsert(entry.animeId);
  filtered.unshift(entry);
  writeHistory(filtered);
}

export function getHistoryEntry(animeId: string): HistoryEntry | undefined {
  return readHistory().find((e) => e.animeId === animeId);
}

export function removeHistoryItem(animeId: string) {
  const list = readHistory().filter((e) => e.animeId !== animeId);
  queueHistoryDeletion(animeId);
  writeHistory(list);
}

export function clearHistory() {
  if (typeof window !== "undefined") {
    localStorage.setItem(CLEAR_KEY, String(Date.now()));
    localStorage.removeItem(DELETED_KEY);
    localStorage.removeItem(UPSERT_KEY);
  }
  writeHistory([]);
}

export function clearLocalHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(DELETED_KEY);
  localStorage.removeItem(CLEAR_KEY);
  localStorage.removeItem(UPSERT_KEY);
  window.dispatchEvent(new CustomEvent("animes:history-changed"));
}

export function readPendingHistoryUpsertIds(): string[] {
  return readStringArray(UPSERT_KEY);
}

export function readPendingHistoryUpserts(): HistoryEntry[] {
  const upsertIds = new Set(readPendingHistoryUpsertIds());
  if (upsertIds.size === 0) return [];
  const deletedIds = new Set(readDeletedHistoryIds());
  return readHistory().filter((entry) => upsertIds.has(entry.animeId) && !deletedIds.has(entry.animeId));
}

export function removePendingHistoryUpserts(ids: string[]) {
  if (typeof window === "undefined") return;
  const removed = new Set(ids);
  const remaining = readPendingHistoryUpsertIds().filter((id) => !removed.has(id));
  if (remaining.length > 0) {
    localStorage.setItem(UPSERT_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(UPSERT_KEY);
  }
}

export function readDeletedHistoryIds(): string[] {
  return readStringArray(DELETED_KEY);
}

export function removeDeletedHistoryIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const removed = new Set(ids);
  const remaining = readDeletedHistoryIds().filter((id) => !removed.has(id));
  if (remaining.length > 0) {
    localStorage.setItem(DELETED_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(DELETED_KEY);
  }
}

export function hasPendingHistoryClear(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CLEAR_KEY) !== null;
}

export function clearPendingHistoryClear() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLEAR_KEY);
  localStorage.removeItem(DELETED_KEY);
  localStorage.removeItem(UPSERT_KEY);
}
