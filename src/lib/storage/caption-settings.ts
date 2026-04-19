export type CaptionFontFamily = "archia" | "noto-sans" | "inter" | "nunito" | "system";
export type CaptionBackground = "none" | "dim" | "solid";
export type CaptionOutline = "none" | "thin" | "medium" | "thick";

export type CaptionSettings = {
  fontFamily: CaptionFontFamily;
  fontSizeScale: number;
  textColor: string;
  background: CaptionBackground;
  outline: CaptionOutline;
  shadow: boolean;
};

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  fontFamily: "archia",
  fontSizeScale: 1.15,
  textColor: "#ffffff",
  background: "none",
  outline: "thin",
  shadow: true,
};

const KEY = "animes:caption-settings";
const EVENT = "animes:caption-settings-changed";

export function readCaptionSettings(): CaptionSettings {
  if (typeof window === "undefined") return DEFAULT_CAPTION_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CAPTION_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CAPTION_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CAPTION_SETTINGS;
  }
}

export function writeCaptionSettings(next: Partial<CaptionSettings>) {
  if (typeof window === "undefined") return;
  const merged = { ...readCaptionSettings(), ...next };
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function resetCaptionSettings() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(DEFAULT_CAPTION_SETTINGS));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const CAPTION_SETTINGS_EVENT = EVENT;

export const FONT_FAMILY_STACKS: Record<CaptionFontFamily, string> = {
  archia:
    "'Archia', var(--font-inter), var(--font-noto-sans), system-ui, sans-serif",
  "noto-sans": "var(--font-noto-sans), system-ui, sans-serif",
  inter: "var(--font-inter), system-ui, sans-serif",
  nunito: "var(--font-nunito), system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export const FONT_FAMILY_LABELS: Record<CaptionFontFamily, string> = {
  archia: "Archia",
  "noto-sans": "Noto Sans",
  inter: "Inter",
  nunito: "Nunito",
  system: "Sistem",
};

export function buildCaptionCssVars(s: CaptionSettings): Record<string, string> {
  const bg =
    s.background === "none"
      ? "transparent"
      : s.background === "dim"
      ? "rgba(0,0,0,0.55)"
      : "rgba(0,0,0,0.9)";

  const backdrop = s.background === "none" ? "none" : "blur(8px)";

  const outlineWidth =
    s.outline === "none" ? 0 : s.outline === "thin" ? 1 : s.outline === "medium" ? 1.5 : 2.25;

  const outlineLayers =
    outlineWidth === 0
      ? ""
      : [
          `${outlineWidth}px 0 0 #000`,
          `-${outlineWidth}px 0 0 #000`,
          `0 ${outlineWidth}px 0 #000`,
          `0 -${outlineWidth}px 0 #000`,
          `${outlineWidth}px ${outlineWidth}px 0 #000`,
          `-${outlineWidth}px -${outlineWidth}px 0 #000`,
          `${outlineWidth}px -${outlineWidth}px 0 #000`,
          `-${outlineWidth}px ${outlineWidth}px 0 #000`,
        ].join(", ");

  const shadowLayer = s.shadow ? "0 2px 4px rgba(0,0,0,0.9)" : "";

  const textShadow =
    [outlineLayers, shadowLayer].filter(Boolean).join(", ") || "none";

  // Maps to Vidstack's built-in caption CSS variables consumed by
  // `@vidstack/react/player/styles/default/theme.css` on `.vds-captions`.
  return {
    "--media-user-font-family": FONT_FAMILY_STACKS[s.fontFamily],
    "--media-user-font-size": String(s.fontSizeScale),
    "--media-user-text-color": s.textColor,
    "--media-user-text-bg": bg,
    "--media-user-display-bg": "transparent",
    "--media-user-text-shadow": textShadow,
    "--media-cue-backdrop": backdrop,
  };
}
