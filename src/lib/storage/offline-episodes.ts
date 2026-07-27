const DB_NAME = "calium-offline";
const DB_VERSION = 1;
const STORE_NAME = "episodes";

export type OfflineEpisode = {
  id: string;
  animeId: string;
  animeName: string;
  poster: string | null;
  episodeId: string;
  episodeName: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  videoBlob: Blob;
  videoType: string;
  videoUrl: string;
  quality: string | null;
  dubLabel: string | null;
  subtitles: OfflineSubtitle[];
  downloadedAt: number;
  totalBytes: number;
};

export type OfflineEpisodeMeta = Omit<OfflineEpisode, "videoBlob" | "subtitles"> & {
  subtitleCount: number;
};

export type OfflineSubtitle = {
  name: string;
  language: string | null;
  vttBlob: Blob;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB kullanılamıyor"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineEpisode(episode: OfflineEpisode): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(episode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineEpisode(id: string): Promise<OfflineEpisode | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineEpisodeMetas(): Promise<OfflineEpisodeMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const episodes = req.result as OfflineEpisode[];
      resolve(
        episodes
          .map((ep) => ({
            id: ep.id,
            animeId: ep.animeId,
            animeName: ep.animeName,
            poster: ep.poster,
            episodeId: ep.episodeId,
            episodeName: ep.episodeName,
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber,
            videoType: ep.videoType,
            videoUrl: ep.videoUrl,
            quality: ep.quality,
            dubLabel: ep.dubLabel,
            subtitleCount: ep.subtitles.length,
            downloadedAt: ep.downloadedAt,
            totalBytes: ep.totalBytes,
          }))
          .sort((a, b) => b.downloadedAt - a.downloadedAt)
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function isEpisodeDownloaded(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getKey(id);
    req.onsuccess = () => resolve(req.result !== undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineEpisode(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function offlineEpisodeKey(
  animeId: string,
  episodeId: string,
  quality: string | null,
  dubLabel: string | null
): string {
  const q = quality ?? "auto";
  const d = dubLabel ?? "default";
  return `${animeId}::${episodeId}::${q}::${d}`;
}
