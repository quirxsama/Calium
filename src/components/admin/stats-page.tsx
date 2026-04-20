"use client";
import { useEffect, useState } from "react";
import { Users, Heart, Clock, TrendingUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  todayUsers: number;
  weekUsers: number;
  totalFavorites: number;
  totalHistory: number;
};

export function AdminStatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStats(j.stats);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">İstatistikler</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <h1 className="text-2xl font-bold">İstatistikler</h1>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Veriler yüklenemedi.</p>
      </div>
    );
  }

  const items = [
    { label: "Toplam Kullanıcı", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Bugün Kayıt", value: stats.todayUsers, icon: Calendar, color: "text-cyan-400" },
    { label: "Bu Hafta Kayıt", value: stats.weekUsers, icon: TrendingUp, color: "text-green-400" },
    { label: "Toplam Favori", value: stats.totalFavorites, icon: Heart, color: "text-pink-400" },
    { label: "Toplam İzleme Kaydı", value: stats.totalHistory, icon: Clock, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">İstatistikler</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={cn("h-5 w-5", item.color)} />
                <span className="text-sm text-[var(--muted-foreground)]">{item.label}</span>
              </div>
              <p className="text-3xl font-bold">{item.value.toLocaleString("tr-TR")}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
        Detaylı grafikler ve trend analizleri yakında eklenecektir.
      </div>
    </div>
  );
}
