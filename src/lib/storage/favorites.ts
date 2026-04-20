export type FavoriteEntry = {
  id: string;
  name: string;
  poster?: string | null;
  addedAt: number;
};

const KEY = "animes:favorites";

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
  list.unshift({ ...entry, addedAt: Date.now() });
  write(list);
}

export function removeFavorite(id: string) {
  write(readFavorites().filter((f) => f.id !== id));
}

export function toggleFavorite(entry: Omit<FavoriteEntry, "addedAt">) {
  if (isFavorite(entry.id)) removeFavorite(entry.id);
  else addFavorite(entry);
}

export function clearFavorites() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("animes:favorites-changed"));
}
