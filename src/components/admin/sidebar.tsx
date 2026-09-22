"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Shield, Settings, BarChart3, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: Users },
  { href: "/admin/moderasyon", label: "Moderasyon", icon: Shield },
  { href: "/admin/istatistikler", label: "İstatistikler", icon: BarChart3 },
  { href: "/admin/apk", label: "Mobil APK", icon: Smartphone },
  { href: "/admin/ayarlar", label: "Site Ayarları", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col gap-1">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        Admin Paneli
      </h2>
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = n.exact
          ? pathname === n.href
          : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </aside>
  );
}
