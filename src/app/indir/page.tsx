import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  Bell,
  Sparkles,
  HelpCircle,
  FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mobil Uygulama (APK) İndir | Calium",
  description:
    "Calium Android mobil uygulamasını indirin. Kesintisiz, yüksek kaliteli ve senkronize anime deneyimini cebinizde yaşayın.",
};

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function DownloadPage() {
  const latestRelease = await prisma.appRelease.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Arka plan ışık efektleri */}
      <div className="pointer-events-none absolute inset-0 flex justify-center -z-10">
        <div className="h-[450px] w-[700px] bg-gradient-to-tr from-[var(--primary)]/20 via-sky-500/15 to-transparent blur-[120px] rounded-full opacity-60" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3.5 py-1.5 text-xs font-medium text-[var(--primary)] shadow-sm">
            <Smartphone className="h-3.5 w-3.5" />
            Android İçin Calium Mobil
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
            Anime Keyfi Artık{" "}
            <span className="bg-gradient-to-r from-[var(--primary)] to-sky-400 bg-clip-text text-transparent">
              Cebinizde
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Calium mobil uygulamasıyla en popüler animeleri dilediğiniz her yerde yüksek çözünürlükle
            izleyin. Senkronize izleme geçmişi ve yeni bölüm bildirimleriyle hiçbir anı kaçırmayın.
          </p>

          {/* İndirme Butonu / Durum Kutusu */}
          <div className="pt-4 flex flex-col items-center gap-3">
            {latestRelease ? (
              <>
                <a
                  href="/api/apk/download"
                  className="group relative inline-flex items-center gap-3 rounded-2xl bg-[var(--primary)] px-8 py-4 text-base font-semibold text-[var(--primary-foreground)] shadow-xl shadow-[var(--primary)]/25 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
                >
                  <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                  <span>Android APK İndir</span>
                  <span className="rounded-md bg-black/20 px-2 py-0.5 text-xs font-normal">
                    {latestRelease.version}
                  </span>
                </a>

                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--muted-foreground)]">
                  <span>Boyut: <strong className="text-[var(--foreground)]">{formatBytes(latestRelease.fileSize)}</strong></span>
                  <span>•</span>
                  <span>Güncelleme: <strong className="text-[var(--foreground)]">{formatDate(latestRelease.createdAt)}</strong></span>
                  <span>•</span>
                  <span>İndirilme: <strong className="text-[var(--foreground)]">{latestRelease.downloadCount} kez</strong></span>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/70 p-6 text-center max-w-md">
                <Smartphone className="h-8 w-8 text-[var(--primary)] mx-auto mb-2 opacity-80" />
                <h3 className="font-semibold text-[var(--foreground)]">Mobil Sürüm Hazırlanıyor</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Android APK sürümü çok yakında yayınlanacak. Güncellemeler için takipte kalın!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sürüm Notları (Eğer varsa) */}
        {latestRelease?.notes && (
          <div className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)] mb-2">
              <FileText className="h-4 w-4 text-[var(--primary)]" />
              Sürüm {latestRelease.version} Yenilikleri:
            </div>
            <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line leading-relaxed">
              {latestRelease.notes}
            </p>
          </div>
        )}

        {/* Özellikler Grid */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Mobil Uygulama Ayrıcalıkları
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              Neden mobil uygulamayı tercih etmelisiniz?
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-6 backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:bg-[var(--card)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-1">Hızlı & Akıcı</h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Mobilde optimize edilmiş video oynatıcıyla donma veya takılma olmadan kesintisiz izleyin.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-6 backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:bg-[var(--card)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] mb-4">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-1">Tam Senkronizasyon</h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                İzleme geçmişiniz, favorileriniz ve listeleriniz web ile mobil arasında anında senkronize olur.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-6 backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:bg-[var(--card)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 mb-4">
                <Bell className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-1">Bölüm Bildirimleri</h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Favori animelerinizin yeni bölümleri yayınlandığı anda cebinize anlık bildirim gelsin.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-6 backdrop-blur-sm transition hover:border-[var(--primary)]/40 hover:bg-[var(--card)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-1">Güvenli & Doğrudan</h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Resmi Calium kaynaklarından derlenmiş, üçüncü taraf reklam veya zararlı kod içermeyen temiz paket.
              </p>
            </div>
          </div>
        </div>

        {/* Nasıl Kurulur? */}
        <div className="mt-20 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-10">
          <div className="max-w-2xl mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] mb-3">
              <HelpCircle className="h-3.5 w-3.5" />
              Rehber
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              APK Dosyası Nasıl Kurulur?
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Android cihazınıza Calium uygulamasını yüklemek yalnızca birkaç saniyenizi alır.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-sm mb-3">
                1
              </div>
              <h4 className="font-semibold text-sm mb-1">APK Dosyasını İndirin</h4>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Yukarıdaki &quot;Android APK İndir&quot; butonuna dokunarak kurulum dosyasını telefonunuza indirin.
              </p>
            </div>

            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-sm mb-3">
                2
              </div>
              <h4 className="font-semibold text-sm mb-1">Yüklemeye İzin Verin</h4>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                İndirme tamamlandığında bildirime tıklayın. Güvenlik uyarısı çıkarsa tarayıcınız için &quot;Bilinmeyen kaynaklardan yükle&quot; iznini açın.
              </p>
            </div>

            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-sm mb-3">
                3
              </div>
              <h4 className="font-semibold text-sm mb-1">Kurulumu Tamamlayın</h4>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                &quot;Yükle&quot; butonuna dokunup kurulumu tamamlayın. Uygulamayı açarak Calium hesabınızla giriş yapın ve izlemeye başlayın!
              </p>
            </div>
          </div>
        </div>

        {/* Sıkça Sorulan Sorular */}
        <div className="mt-20 max-w-3xl mx-auto space-y-4">
          <h2 className="text-xl font-bold text-center mb-6">Sıkça Sorulan Sorular</h2>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h4 className="font-semibold text-sm text-[var(--foreground)]">
              Calium APK dosyası güvenli mi?
            </h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-2 leading-relaxed">
              Evet. APK dosyası doğrudan Calium sunucularında barındırılır. Hiçbir casus yazılım veya üçüncü taraf reklam içermez.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h4 className="font-semibold text-sm text-[var(--foreground)]">
              Yeni bir sürüm çıktığında nasıl güncellerim?
            </h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-2 leading-relaxed">
              Bu sayfadan yeni APK&apos;yı indirip mevcut uygulamanın üzerine yüklemeniz yeterlidir. Verileriniz ve oturumunuz kaybolmaz.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h4 className="font-semibold text-sm text-[var(--foreground)]">
              iOS (iPhone / iPad) desteği var mı?
            </h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-2 leading-relaxed">
              iOS cihazlarda Safari üzerinden Calium&apos;u açıp &quot;Paylaş &gt; Ana Ekrana Ekle&quot; seçeneğini kullanarak tıpkı bir mobil uygulama gibi tam ekran kullanabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
