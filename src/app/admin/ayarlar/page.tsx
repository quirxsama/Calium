export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Site Ayarları</h1>
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--muted-foreground)]">
          Site ayarları modülü henüz aktif değil.
        </p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Bakım modu, duyurular ve genel site yapılandırması burada yönetilecektir.
        </p>
      </div>
    </div>
  );
}
