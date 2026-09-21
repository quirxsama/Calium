"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, Heart, BookOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/kesfet", label: "Keşfet", icon: Sparkles },
  { href: "/kutuphanem", label: "Kütüphane", icon: BookOpen },
  { href: "/favoriler", label: "Favoriler", icon: Heart },
  { href: "/ayarlar", label: "Hesap", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  // İzle sayfasında bottom nav'ı gizle (player fullscreen deneyimi için)
  if (pathname.startsWith("/izle")) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl safe-bottom"
      aria-label="Mobil navigasyon"
    >
      <div className="flex items-center justify-around h-16">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 w-full h-full text-[10px] font-medium transition-colors",
                active
                  ? "text-[var(--primary)]"
                  : "text-[var(--muted-foreground)]"
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-6 rounded-full bg-[var(--primary)] transition-all" />
              )}
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  active && "scale-110"
                )}
                strokeWidth={active ? 2.5 : 2}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
