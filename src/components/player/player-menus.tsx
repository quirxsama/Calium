"use client";
import {
  DefaultMenuRadioGroup,
  DefaultMenuSection,
} from "@vidstack/react/player/layouts/default";

type QualityOption = { label: string; value: string };

export function QualityMenuItem({
  options,
  value,
  onChange,
  disabled,
}: {
  options: QualityOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (options.length <= 1 || disabled) return null;
  return (
    <DefaultMenuSection label="Kalite">
      <DefaultMenuRadioGroup value={value} options={options} onChange={onChange} />
    </DefaultMenuSection>
  );
}

export function AudioTrackMenuItem({
  options,
  value,
  onChange,
  disabled,
}: {
  options: QualityOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (options.length <= 1 || disabled) return null;
  return (
    <DefaultMenuSection label="Ses / Dublaj">
      <DefaultMenuRadioGroup value={value} options={options} onChange={onChange} />
    </DefaultMenuSection>
  );
}

export { CaptionStyleSubmenu } from "./caption-style-submenu";
