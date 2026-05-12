export type FavoriteEntry = {
  id: string;
  name: string;
  poster?: string | null;
  addedAt: number;
};

const KEY = "animes:favorites";
const DELETED_KEY = "animes:favorites-deleted";
const CLEAR_KEY = "animes:favorites-clear-requested-at";
const UPSERT_KEY = "animes:favorites-upserts";

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

function queueFavoriteDeletion(id: string) {
  if (typeof window === "undefined") return;
  if (hasPendingFavoriteClear()) return;
  removePendingFavoriteUpserts([id]);
  const deleted = new Set(readDeletedFavoriteIds());
  deleted.add(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted]));
}

function queueFavoriteUpsert(id: string) {
  if (typeof window === "undefined") return;
  if (hasPendingFavoriteClear()) return;
  const upserts = new Set(readPendingFavoriteUpsertIds());
  upserts.add(id);
  localStorage.setItem(UPSERT_KEY, JSON.stringify([...upserts]));
}

export function readFavorites(): FavoriteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FavoriteEntry[];
  } catch {
    return [];
  }
}

function write(list: FavoriteEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("animes:favorites-changed"));
}

export function isFavorite(id: string): boolean {
  return readFavorites().some((f) => f.id === id);
}

export function addFavorite(entry: Omit<FavoriteEntry, "addedAt">) {
  const list = readFavorites();
  if (list.some((f) => f.id === entry.id)) return;
  removeDeletedFavoriteIds([entry.id]);
  queueFavoriteUpsert(entry.id);
  list.unshift({ ...entry, addedAt: Date.now() });
  write(list);
}

export function removeFavorite(id: string) {
  queueFavoriteDeletion(id);
  write(readFavorites().filter((f) => f.id !== id));
}

export function toggleFavorite(entry: Omit<FavoriteEntry, "addedAt">) {
  if (isFavorite(entry.id)) removeFavorite(entry.id);
  else addFavorite(entry);
}

export function clearFavorites() {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLEAR_KEY, String(Date.now()));
  localStorage.removeItem(DELETED_KEY);
  localStorage.removeItem(UPSERT_KEY);
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("animes:favorites-changed"));
}

export function clearLocalFavorites() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(DELETED_KEY);
  localStorage.removeItem(CLEAR_KEY);
  localStorage.removeItem(UPSERT_KEY);
  window.dispatchEvent(new CustomEvent("animes:favorites-changed"));
}

export function readPendingFavoriteUpsertIds(): string[] {
  return readStringArray(UPSERT_KEY);
}

export function readPendingFavoriteUpserts(): FavoriteEntry[] {
  const upsertIds = new Set(readPendingFavoriteUpsertIds());
  if (upsertIds.size === 0) return [];
  const deletedIds = new Set(readDeletedFavoriteIds());
  return readFavorites().filter((favorite) => upsertIds.has(favorite.id) && !deletedIds.has(favorite.id));
}

export function removePendingFavoriteUpserts(ids: string[]) {
  if (typeof window === "undefined") return;
  const removed = new Set(ids);
  const remaining = readPendingFavoriteUpsertIds().filter((id) => !removed.has(id));
  if (remaining.length > 0) {
    localStorage.setItem(UPSERT_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(UPSERT_KEY);
  }
}

export function readDeletedFavoriteIds(): string[] {
  return readStringArray(DELETED_KEY);
}

export function removeDeletedFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const removed = new Set(ids);
  const remaining = readDeletedFavoriteIds().filter((id) => !removed.has(id));
  if (remaining.length > 0) {
    localStorage.setItem(DELETED_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(DELETED_KEY);
  }
}

export function hasPendingFavoriteClear(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CLEAR_KEY) !== null;
}

export function clearPendingFavoriteClear() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLEAR_KEY);
  localStorage.removeItem(DELETED_KEY);
  localStorage.removeItem(UPSERT_KEY);
}
