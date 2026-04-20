"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/context";
import { User, Settings, List, LogOut, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (loading) {
    return (
      <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--muted)]" />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/giris"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
        >
          <LogIn className="h-4 w-4" />
          Giriş
        </Link>
        <Link
          href="/kayit"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Kayıt Ol</span>
          <span className="sm:hidden">Kayıt</span>
        </Link>
      </div>
    );
  }

  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--card)] transition hover:ring-2 hover:ring-[var(--primary)]/30"
        aria-label="Hesap menüsü"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.username}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-[var(--muted-foreground)]">{initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/20 z-50">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">
              {user.displayName || user.username}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">{user.email}</p>
          </div>

          <div className="py-1">
            <MenuLink href={`/profil/${user.username}`} icon={User} label="Profilim" onClick={() => setOpen(false)} />
            <MenuLink href="/listelerim" icon={List} label="Listelerim" onClick={() => setOpen(false)} />
            <MenuLink href="/ayarlar" icon={Settings} label="Ayarlar" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t border-[var(--border)] py-1">
            <button
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition hover:bg-[var(--muted)]"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
      )}
    >
      <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
      {label}
    </Link>
  );
}
