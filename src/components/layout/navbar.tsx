"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Flame, Heart, Clock, Home, Sparkles, Mic, Users, CalendarDays, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account/account-menu";
import { NotificationBell } from "@/components/social/notification-bell";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/kesfet", label: "Keşfet", icon: Sparkles },
  { href: "/kutuphanem", label: "Kütüphanem", icon: BookOpen },
  { href: "/yayin-takvimi", label: "Takvim", icon: CalendarDays },
  { href: "/top", label: "Top 100", icon: Flame },
  { href: "/dublaj", label: "Türkçe Dublaj", icon: Mic },
  { href: "/arkadaslar", label: "Sosyal", icon: Users },
  { href: "/favoriler", label: "Favoriler", icon: Heart },
  { href: "/gecmis", label: "Geçmiş", icon: Clock },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/arama?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 pt-[env(safe-area-inset-top)]",
        scrolled
          ? "backdrop-blur-xl bg-[var(--background)]/75 border-b border-[var(--border)] shadow-[0_4px_24px_-12px_rgba(0,0,0,0.4)]"
          : "backdrop-blur-md bg-[var(--background)]/70 sm:bg-gradient-to-b sm:from-[var(--background)]/60 sm:to-transparent sm:backdrop-blur-none border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 font-bold text-lg">
          <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-[var(--primary)]/30 transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/icon.webp"
              alt="Calium"
              width={36}
              height={36}
              priority
              className="relative z-10 h-full w-full object-cover"
            />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </span>
          <span className="hidden sm:inline tracking-tight">Calium</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative px-3.5 py-2 text-sm rounded-full transition-colors",
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-[var(--muted)] ring-1 ring-[var(--border)]" aria-hidden="true" />
                )}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <form onSubmit={submit} className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Anime ara…"
              className="w-full h-10 rounded-full border border-[var(--border)] bg-[var(--card)] pl-9 pr-4 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
            />
          </div>
        </form>

        <NotificationBell />
        {/* Mobilde tema switch yerine Sosyal kısayolu; masaüstünde tema kalır. */}
        <Link
          href="/arkadaslar"
          aria-label="Sosyal"
          className={cn(
            "md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition hover:bg-[var(--muted)]",
            pathname.startsWith("/arkadaslar") && "text-[var(--primary)] border-[var(--primary)]/40"
          )}
        >
          <Users className="h-4 w-4" />
        </Link>
        <ThemeToggle className="hidden md:inline-flex" />
        <AccountMenu />
      </div>
    </header>
  );
}
