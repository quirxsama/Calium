"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

import { queueIntegrationSync, loadIntegrations } from "@/lib/integration-client";

interface Connection {
  provider: "mal" | "anilist";
  connected: boolean;
  username: string | null;
  status: string;
  lastSyncedAt: string | null;
  error: string | null;
}

interface Conflict {
  entryId: string;
  provider: "mal" | "anilist";
  version: number;
  fields: string[];
  base: Record<string, unknown> | null;
  remote: Record<string, unknown> | null;
}

interface Entry {
  id: string;
  title: string;
  version: number;
  value: Record<string, unknown>;
  deleted: boolean;
}

export function IntegrationsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const resolvingRef = useRef(false);
  const [resolving, setResolving] = useState(false);

  const loadData = useCallback(async () => {
    const data = await loadIntegrations();
    setConnections(data.connections || []);
    setConflicts(data.conflicts || []);
    setEntries(data.entries || []);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const data = await loadIntegrations();
        if (!active) return;
        setConnections(data.connections || []);
        setConflicts(data.conflicts || []);
        setEntries(data.entries || []);
      } catch {
        if (active) setMessage({ type: "error", text: "Entegrasyonlar yüklenemedi. Otomatik tekrar denenecek." });
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(poll, 5000);
        }
      }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, []);

  async function handleLink(provider: "mal" | "anilist") {
    setActionLoading(provider);
    setMessage(null);
    try {
      const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
      const random = new Uint8Array(43);
      crypto.getRandomValues(random);
      const verifier = Array.from(random, (byte) => charset[byte % charset.length]).join("");
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const startRes = await fetch(`/api/auth/oauth/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "link", platform: "web", challenge }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || "Bağlantı başlatılamadı");
      }
      const { authorizationUrl, transactionId } = await startRes.json();
      const popup = window.open(authorizationUrl, "_blank", "width=600,height=750");

      let linked = false;
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const exRes = await fetch("/api/auth/oauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId, verifier }),
        });
        if (exRes.status === 200) {
          const data = await exRes.json();
          if (data.pending) continue;
          if (data.linked) {
            linked = true;
            popup?.close();
            setMessage({ type: "success", text: `${provider.toUpperCase()} hesabı başarıyla bağlandı.` });
            await queueIntegrationSync();
            await loadData();
            break;
          }
        } else if (exRes.status >= 400 && exRes.status !== 404) {
          const err = await exRes.json().catch(() => ({}));
          throw new Error(err.error || "Yetkilendirme başarısız");
        }
      }
      if (!linked) throw new Error("Bağlantı zaman aşımına uğradı");
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Bağlantı kurulamadı" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisconnect(provider: "mal" | "anilist") {
    setActionLoading(`disconnect-${provider}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Bağlantı kesilemedi");
      }
      setMessage({ type: "success", text: `${provider.toUpperCase()} bağlantısı kesildi.` });
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "İşlem başarısız" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      await queueIntegrationSync();
      await new Promise((r) => setTimeout(r, 1200));
      await loadData();
      setMessage({ type: "success", text: "Senkronizasyon kuyruğa alındı." });
    } catch {
      setMessage({ type: "error", text: "Senkronizasyon başlatılamadı." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleResolve(conflict: Conflict, choice: "local" | "remote") {
    if (resolvingRef.current) return;
    const entry = entries.find((e) => e.id === conflict.entryId);
    const deleting = choice === "remote" ? conflict.remote === null : (entry?.deleted ?? false);
    if (deleting && !window.confirm("Bu seçim kaydı siler. Silmeyi onaylıyor musunuz?")) return;
    resolvingRef.current = true;
    setResolving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tracking/conflicts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: conflict.entryId,
          provider: conflict.provider,
          version: conflict.version,
          entryVersion: entry?.version,
          choice,
          confirmDeletion: deleting,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Çakışma çözülemedi");
      }
      setConflicts((prev) => prev.filter((c) => c.entryId !== conflict.entryId || c.provider !== conflict.provider));
      setMessage({ type: "success", text: "Çakışma başarıyla çözüldü." });
      await loadData();
    } catch (err) {
      const code = err instanceof Error ? err.message : "Çözüm başarısız";
      setMessage({
        type: "error",
        text: code === "integration_busy"
          ? "Senkronizasyon sürüyor. Lütfen birkaç saniye sonra tekrar deneyin."
          : code === "version_conflict"
          ? "Veri değişti. Güncel liste yüklendi, lütfen seçiminizi tekrar yapın."
          : "Çakışma çözülemedi: " + code,
      });
      await loadData().catch(() => {});
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const mal = connections.find((c) => c.provider === "mal");
  const anilist = connections.find((c) => c.provider === "anilist");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Entegrasyonlar</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            AniList ve MyAnimeList hesaplarınızı bağlayın, listelerinizi ve izleme ilerlemenizi otomatik senkronize edin.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Senkronize Ediliyor..." : "Şimdi Eşitle"}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="mb-4 flex items-center gap-2 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold">Çözülmesi Gereken Çakışmalar ({conflicts.length})</h3>
          </div>
          <div className="space-y-3">
            {conflicts.map((conflict, idx) => {
              const entry = entries.find((e) => e.id === conflict.entryId);
              return (
                <div
                  key={idx}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h4 className="font-medium text-[var(--foreground)]">{entry?.title ?? conflict.entryId}</h4>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {conflict.provider.toUpperCase()} ile farklı alanlar: {conflict.fields.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={resolving}
                      onClick={() => handleResolve(conflict, "local")}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
                    >
                      Calium Verisini Tut
                    </button>
                    <button
                      disabled={resolving}
                      onClick={() => handleResolve(conflict, "remote")}
                      className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
                    >
                      {conflict.provider.toUpperCase()} Verisini Al
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#02A9FF]/15 font-black text-[#02A9FF]">
                AL
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">AniList</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {anilist?.connected ? `Bağlı (@${anilist.username})` : "Bağlı değil"}
                </p>
              </div>
            </div>
            {anilist?.connected && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          </div>
          <p className="mb-5 text-xs text-[var(--muted-foreground)]">
            İzleme geçmişi, durum, puan ve bölüm sayısını AniList ile çift taraflı senkronize eder.
          </p>
          {anilist?.connected ? (
            <button
              onClick={() => handleDisconnect("anilist")}
              disabled={actionLoading === "disconnect-anilist"}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {actionLoading === "disconnect-anilist" ? "Kesiliyor..." : "Bağlantıyı Kes"}
            </button>
          ) : (
            <button
              onClick={() => handleLink("anilist")}
              disabled={actionLoading === "anilist"}
              className="w-full rounded-xl bg-[#02A9FF] py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading === "anilist" ? "Bağlanıyor..." : "AniList ile Bağlan"}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E51A2]/15 font-black text-[#688ee4]">
                MAL
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">MyAnimeList</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {mal?.connected ? `Bağlı (@${mal.username})` : "Bağlı değil"}
                </p>
              </div>
            </div>
            {mal?.connected && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          </div>
          <p className="mb-5 text-xs text-[var(--muted-foreground)]">
            İzleme durumunu ve ilerlemenizi MyAnimeList hesabınızla çift taraflı günceller.
          </p>
          {mal?.connected ? (
            <button
              onClick={() => handleDisconnect("mal")}
              disabled={actionLoading === "disconnect-mal"}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {actionLoading === "disconnect-mal" ? "Kesiliyor..." : "Bağlantıyı Kes"}
            </button>
          ) : (
            <button
              onClick={() => handleLink("mal")}
              disabled={actionLoading === "mal"}
              className="w-full rounded-xl bg-[#2E51A2] py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading === "mal" ? "Bağlanıyor..." : "MyAnimeList ile Bağlan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
