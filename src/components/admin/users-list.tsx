"use client";
import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  profilePublic: boolean;
};

type Data = {
  users: UserRow[];
  page: number;
  totalPages: number;
  total: number;
};

export function AdminUsersClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const load = useCallback(
    (p: number, q: string) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("q", q);
      fetch(`/api/admin/users?${params}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setData(j);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    load(page, query);
  }, [page, load]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, query);
  }

  async function changeRole(userId: string, action: "promote" | "demote") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const j = await res.json();
    if (j.success) {
      toast(action === "promote" ? "Admin yapıldı" : "Admin kaldırıldı", "success");
      load(page, query);
    } else {
      toast(j.error ?? "Hata oluştu", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Kullanıcılar</h1>
        <form onSubmit={search} className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kullanıcı ara…"
            className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pl-9 pr-4 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25"
          />
        </form>
      </div>

      {data && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Toplam {data.total} kullanıcı
        </p>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Kullanıcı Adı</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">E-posta</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Rol</th>
              <th className="px-4 py-2.5 text-left font-medium text-[var(--muted-foreground)]">Kayıt</th>
              <th className="px-4 py-2.5 text-right font-medium text-[var(--muted-foreground)]">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td colSpan={5} className="px-4 py-3"><div className="skeleton h-4 w-full rounded" /></td>
                </tr>
              ))
            ) : data?.users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  Kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              data?.users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition">
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">{u.email}</td>
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
                  <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                    {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {u.role === "admin" ? (
                      <button
                        onClick={() => changeRole(u.id, "demote")}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] hover:bg-[var(--muted)] transition"
                        title="Admin kaldır"
                      >
                        <ShieldOff className="h-3 w-3" /> Kaldır
                      </button>
                    ) : (
                      <button
                        onClick={() => changeRole(u.id, "promote")}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2.5 py-1 text-[11px] text-[var(--primary)] hover:bg-[var(--primary)]/20 transition"
                        title="Admin yap"
                      >
                        <ShieldCheck className="h-3 w-3" /> Admin Yap
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Önceki
          </button>
          <span className="text-xs text-[var(--muted-foreground)]">
            Sayfa {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Sonraki <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
