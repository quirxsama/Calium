"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { User, KeyRound, Palette, Subtitles, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileTab } from "@/components/settings/profile-tab";
import { AccountTab } from "@/components/settings/account-tab";
import { AppearanceTab } from "@/components/settings/appearance-tab";
import { CaptionTab } from "@/components/settings/caption-tab";
import { PlayerTab } from "@/components/settings/player-tab";

const TABS = [
  { key: "profil", label: "Profil", icon: User },
  { key: "hesap", label: "Hesap", icon: KeyRound },
  { key: "gorunum", label: "Görünüm", icon: Palette },
  { key: "altyazi", label: "Altyazı", icon: Subtitles },
  { key: "oynatici", label: "Oynatıcı", icon: Play },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === "undefined") return "profil";

    const target = new URLSearchParams(window.location.search).get("tab");
    return target === "hesap" || target === "profil" || target === "gorunum" || target === "altyazi" || target === "oynatici" ? target : "profil";
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push("/giris");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-[var(--foreground)]">Ayarlar</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar (desktop) / Scrollable tabs (mobile) */}
        <nav className="flex lg:w-56 lg:flex-col lg:shrink-0 gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] lg:pr-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition",
                  active
                    ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {tab === "profil" && <ProfileTab />}
          {tab === "hesap" && <AccountTab />}
          {tab === "gorunum" && <AppearanceTab />}
          {tab === "altyazi" && <CaptionTab />}
          {tab === "oynatici" && <PlayerTab />}
        </div>
      </div>
    </div>
  );
}
