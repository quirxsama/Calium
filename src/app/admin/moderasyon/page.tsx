export const dynamic = "force-dynamic";

export default function ModerationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moderasyon</h1>
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--muted-foreground)]">
          İçerik moderasyon sistemi henüz aktif değil.
        </p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Kullanıcı raporları ve liste moderasyonu burada görünecektir.
        </p>
      </div>
    </div>
  );
}
