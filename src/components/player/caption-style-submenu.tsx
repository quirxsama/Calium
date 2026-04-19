"use client";
import { Menu } from "@vidstack/react";
import {
  DefaultMenuButton,
  DefaultMenuRadioGroup,
  DefaultMenuSection,
} from "@vidstack/react/player/layouts/default";
import {
  FONT_FAMILY_LABELS,
  type CaptionBackground,
  type CaptionFontFamily,
  type CaptionOutline,
  type CaptionSettings,
} from "@/lib/storage/caption-settings";

const FONT_OPTIONS: { label: string; value: CaptionFontFamily }[] = [
  { label: FONT_FAMILY_LABELS.archia, value: "archia" },
  { label: FONT_FAMILY_LABELS["noto-sans"], value: "noto-sans" },
  { label: FONT_FAMILY_LABELS.inter, value: "inter" },
  { label: FONT_FAMILY_LABELS.nunito, value: "nunito" },
  { label: FONT_FAMILY_LABELS.system, value: "system" },
];

const OUTLINE_OPTIONS: { label: string; value: CaptionOutline }[] = [
  { label: "Yok", value: "none" },
  { label: "İnce", value: "thin" },
  { label: "Orta", value: "medium" },
  { label: "Kalın", value: "thick" },
];

const BACKGROUND_OPTIONS: { label: string; value: CaptionBackground }[] = [
  { label: "Yok", value: "none" },
  { label: "Hafif", value: "dim" },
  { label: "Dolu", value: "solid" },
];

const COLOR_OPTIONS: { label: string; value: string }[] = [
  { label: "Beyaz", value: "#ffffff" },
  { label: "Sarı", value: "#ffe14d" },
  { label: "Turuncu", value: "#ffa94d" },
  { label: "Kırmızı", value: "#ff6b6b" },
  { label: "Yeşil", value: "#7bd88f" },
  { label: "Camgöbeği", value: "#7ad6ff" },
];

export function CaptionStyleSubmenu({
  settings,
  onUpdate,
  onReset,
}: {
  settings: CaptionSettings;
  onUpdate: (patch: Partial<CaptionSettings>) => void;
  onReset: () => void;
}) {
  const sizePct = Math.round(settings.fontSizeScale * 100);
  const currentFontLabel = FONT_FAMILY_LABELS[settings.fontFamily];

  return (
    <Menu.Root className="vds-caption-style-menu vds-menu">
      <DefaultMenuButton label="Altyazı Stili" hint={currentFontLabel} />
      <Menu.Items className="vds-menu-items">
        <DefaultMenuSection label="Yazı Tipi">
          <DefaultMenuRadioGroup
            value={settings.fontFamily}
            options={FONT_OPTIONS}
            onChange={(v: string) => onUpdate({ fontFamily: v as CaptionFontFamily })}
          />
        </DefaultMenuSection>

        <DefaultMenuSection label={`Boyut · ${sizePct}%`}>
          <div className="anizium-player-settings-row">
            <input
              type="range"
              min={0.8}
              max={2}
              step={0.05}
              value={settings.fontSizeScale}
              onChange={(e) => onUpdate({ fontSizeScale: Number(e.target.value) })}
              aria-label="Altyazı boyutu"
            />
          </div>
        </DefaultMenuSection>

        <DefaultMenuSection label="Renk">
          <DefaultMenuRadioGroup
            value={settings.textColor}
            options={COLOR_OPTIONS}
            onChange={(v: string) => onUpdate({ textColor: v })}
          />
        </DefaultMenuSection>

        <DefaultMenuSection label="Kenarlık">
          <DefaultMenuRadioGroup
            value={settings.outline}
            options={OUTLINE_OPTIONS}
            onChange={(v: string) => onUpdate({ outline: v as CaptionOutline })}
          />
        </DefaultMenuSection>

        <DefaultMenuSection label="Arka Plan">
          <DefaultMenuRadioGroup
            value={settings.background}
            options={BACKGROUND_OPTIONS}
            onChange={(v: string) => onUpdate({ background: v as CaptionBackground })}
          />
        </DefaultMenuSection>

        <DefaultMenuSection>
          <label className="anizium-player-settings-row cursor-pointer">
            <span>Gölge</span>
            <input
              type="checkbox"
              checked={settings.shadow}
              onChange={(e) => onUpdate({ shadow: e.target.checked })}
              aria-label="Gölge"
            />
          </label>
        </DefaultMenuSection>

        <DefaultMenuSection>
          <button
            type="button"
            onClick={onReset}
            className="w-full rounded-md px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition"
          >
            Varsayılana Sıfırla
          </button>
        </DefaultMenuSection>
      </Menu.Items>
    </Menu.Root>
  );
}
