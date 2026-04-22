import Image from "next/image";
import Link from "next/link";
import { Home, Search } from "lucide-react";

export const metadata = {
  title: "404 — Sayfa Bulunamadı",
};

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <h1 className="text-8xl font-black tracking-tighter text-[var(--primary)] drop-shadow-[0_0_30px_rgba(244,63,94,0.35)] sm:text-9xl">
          404
        </h1>
        <div className="absolute -inset-4 -z-10 rounded-full bg-[var(--primary)]/5 blur-3xl" />
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <Image
          src="https://media.tenor.com/WBxnJ2ae_sgAAAAi/nanami-chia-lonely-lonely-i-guess-i%27m-lonely.gif"
          alt="Dans eden anime kızı"
          width={320}
          height={240}
          className="block"
          priority
          unoptimized
        />
      </div>

      <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
        Burası sessiz… çok sessiz.
      </h2>
      <p className="mb-8 max-w-md text-sm text-[var(--muted-foreground)]">
        Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
        Dans eden anime kızıyla baş başa kaldın.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg transition hover:brightness-110"
        >
          <Home className="h-4 w-4" />
          Ana Sayfa
        </Link>
        <Link
          href="/arama"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
        >
          <Search className="h-4 w-4" />
          Anime Ara
        </Link>
      </div>
    </div>
  );
}
