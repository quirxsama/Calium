import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function truncate(str: string | undefined, n = 180) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n).trimEnd() + "…" : str;
}

export function parseTimeCode(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val > 0 ? val : null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!isNaN(num) && num > 0) return num;
  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function formatAnimeType(type: string | null | undefined): string {
  if (!type) return "";
  const key = String(type).toLowerCase().trim();
  const map: Record<string, string> = {
    series: "Seri",
    serie: "Seri",
    tv: "Seri",
    movie: "Film",
    film: "Film",
    ova: "OVA",
    ona: "ONA",
    special: "Özel",
  };
  return map[key] ?? type;
}
