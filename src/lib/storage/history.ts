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

const KEY = "animes:history";

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
  filtered.unshift(entry);
  writeHistory(filtered);
}

export function getHistoryEntry(animeId: string): HistoryEntry | undefined {
  return readHistory().find((e) => e.animeId === animeId);
}

export function removeHistoryItem(animeId: string) {
  const list = readHistory().filter((e) => e.animeId !== animeId);
  writeHistory(list);
}

export function clearHistory() {
  writeHistory([]);
}
