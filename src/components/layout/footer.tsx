import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 text-sm text-[var(--muted-foreground)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[var(--foreground)] font-semibold mb-1">
              <Image
                src="/icon.webp"
                alt="Calium"
                width={24}
                height={24}
                className="h-6 w-6 rounded-md object-cover"
              />
              Calium
            </div>
            <p>Anime izleme platformu. İçerikler üçüncü taraf kaynaklardan sağlanmaktadır.</p>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/indir" className="transition hover:text-[var(--foreground)]">
              Mobil Uygulama (APK)
            </Link>
            <Link href="/iletisim" className="transition hover:text-[var(--foreground)]">
              İletişim
            </Link>
          </div>

          <div className="text-xs md:text-right">
            <p>© {new Date().getFullYear()} Calium</p>
            <p className="max-w-md">
              Bu site içeriklerin telif haklarını sağlamaz. Tüm haklar ilgili
              lisans sahiplerine aittir. İçerik bildirimleri için yayıncıya
              başvurunuz.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
