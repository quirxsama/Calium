import Link from "next/link";
import { Smartphone, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Site Ayarları</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-base">Mobil APK Yönetimi</h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Android uygulaması için yeni APK sürümleri yükleyin, sürüm notlarını düzenleyin ve
              indirme sayılarını takip edin.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/admin/apk"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              <span>APK Yönetimine Git</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 p-8 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          Diğer site ayarları modülleri (bakım modu, site başlığı, duyurular) geliştirme aşamasındadır.
        </p>
      </div>
    </div>
  );
}
