"use client";
import { useEffect, useState } from "react";
import { Users, Heart, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  todayUsers: number;
  weekUsers: number;
  totalFavorites: number;
  totalHistory: number;
};

type RecentUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  avatarUrl: string | null;
};

type Data = {
  stats: Stats;
  recentUsers: RecentUser[];
} | null;

export function AdminDashboardClient() {
  const [data, setData] = useState<Data>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData({ stats: j.stats, recentUsers: j.recentUsers });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Veriler yüklenemedi.</p>
      </div>
    );
  }

  const cards = [
    {
      label: "Toplam Kullanıcı",
      value: data.stats.totalUsers,
      icon: Users,
      accent: "text-blue-400",
    },
    {
      label: "Bu Hafta Kayıt",
      value: data.stats.weekUsers,
      icon: TrendingUp,
      accent: "text-green-400",
    },
    {
      label: "Toplam Favori",
      value: data.stats.totalFavorites,
      icon: Heart,
      accent: "text-pink-400",
    },
    {
      label: "Toplam İzleme",
      value: data.stats.totalHistory,
      icon: Clock,
      accent: "text-orange-400",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", c.accent)} />
                <span className="text-xs text-[var(--muted-foreground)]">{c.label}</span>
              </div>
              <p className="text-2xl font-bold">{c.value.toLocaleString("tr-TR")}</p>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Son Kayıt Olan Kullanıcılar</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Kullanıcı</th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] hidden sm:table-cell">E-posta</th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Rol</th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)] hidden md:table-cell">Kayıt</th>
              </tr>
            </thead>
            <tbody>
              {data.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)] hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        u.role === "admin"
                          ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      )}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)] hidden md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
