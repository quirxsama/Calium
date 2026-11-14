export const PLAYER_PREFS_STORAGE_KEY = "calium:player-prefs";
export const PLAYER_PREFS_CHANGE_EVENT = "calium:player-prefs-change";

export type PreferredQuality = "auto" | "2160p" | "1440p" | "1080p" | "720p" | "480p";
export type PreferredDubLanguage = "en" | "tr" | "ja";
export type PlayerPreferences = {
  autoPlay: boolean;
  autoSkipIntro: boolean;
  holdSpaceToSpeedUp: boolean;
  defaultQuality: PreferredQuality;
  defaultDubLanguage: PreferredDubLanguage;
};

export function normalizePlayerPreferences(value: unknown): PlayerPreferences {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  // Older player menus stored a number, while the settings/API use e.g. "720p".
  const quality = typeof data.defaultQuality === "number" ? `${data.defaultQuality}p` : data.defaultQuality;
  return {
    autoPlay: typeof data.autoPlay === "boolean" ? data.autoPlay : true,
    autoSkipIntro: typeof data.autoSkipIntro === "boolean" ? data.autoSkipIntro : false,
    holdSpaceToSpeedUp: typeof data.holdSpaceToSpeedUp === "boolean" ? data.holdSpaceToSpeedUp : true,
    defaultQuality: quality === "2160p" || quality === "1440p" || quality === "1080p" || quality === "720p" || quality === "480p" ? quality : "auto",
    defaultDubLanguage: data.defaultDubLanguage === "en" || data.defaultDubLanguage === "tr" ? data.defaultDubLanguage : "ja",
  };
}

export function readPlayerPreferences(): PlayerPreferences {
  try {
    return normalizePlayerPreferences(JSON.parse(localStorage.getItem(PLAYER_PREFS_STORAGE_KEY) ?? "null"));
  } catch {
    return normalizePlayerPreferences(null);
  }
}

export function savePlayerPreferences(update: Partial<PlayerPreferences>): PlayerPreferences {
  const prefs = normalizePlayerPreferences({ ...readPlayerPreferences(), ...update });
  try {
    localStorage.setItem(PLAYER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* Playback should still work when storage is unavailable. */ }
  window.dispatchEvent(new Event(PLAYER_PREFS_CHANGE_EVENT));
  return prefs;
}

export function parseQualityHeight(value: unknown): number | undefined {
  const height = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : NaN;
  return Number.isFinite(height) && height > 0 ? height : undefined;
}

export function getPreferredQualityIndex(variants: { quality?: number }[], preferred: PreferredQuality): number {
  if (preferred === "auto" || variants.length === 0) return 0;
  const target = Number.parseInt(preferred, 10);
  const known = variants.map((variant, index) => ({ height: variant.quality, index }))
    .filter((variant): variant is { height: number; index: number } => variant.height != null && variant.height > 0)
    .sort((a, b) => b.height - a.height);
  return (known.find((variant) => variant.height <= target) ?? known.at(-1))?.index ?? 0;
}
