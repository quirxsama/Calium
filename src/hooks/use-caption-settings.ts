"use client";
import { useEffect, useState } from "react";
import {
  CAPTION_SETTINGS_EVENT,
  DEFAULT_CAPTION_SETTINGS,
  readCaptionSettings,
  writeCaptionSettings,
  resetCaptionSettings,
  type CaptionSettings,
} from "@/lib/storage/caption-settings";

export function useCaptionSettings() {
  const [settings, setSettings] = useState<CaptionSettings>(DEFAULT_CAPTION_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSettings(readCaptionSettings());
      setHydrated(true);
    });
    const onChange = () => setSettings(readCaptionSettings());
    window.addEventListener(CAPTION_SETTINGS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CAPTION_SETTINGS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return {
    settings,
    hydrated,
    update: (patch: Partial<CaptionSettings>) => writeCaptionSettings(patch),
    reset: () => resetCaptionSettings(),
  };
}
