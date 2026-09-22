export async function queueIntegrationSync() {
  const res = await fetch("/api/integrations/sync", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Senkronizasyon başlatılamadı.");
  }
}

export async function loadIntegrations() {
  const res = await fetch("/api/integrations", { cache: "no-store" });
  if (!res.ok) throw new Error("Entegrasyonlar yüklenemedi.");
  return res.json();
}
