import { Mail, Shield, Scale, Heart } from "lucide-react";

export const metadata = {
  title: "İletişim — Calium",
  description: "Calium iletişim bilgileri, yasal uyarılar ve telif hakları bildirimleri.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold text-[var(--foreground)]">İletişim</h1>

      <div className="space-y-8">
        <Section
          icon={<Mail className="h-6 w-6 text-[var(--primary)]" />}
          title="İletişim Bilgileri"
        >
          <p>
            Herhangi bir soru, öneri veya sorun bildirimi için aşağıdaki email
            adresi üzerinden bizimle iletişime geçebilirsiniz.
          </p>
          <p className="mt-2 font-medium text-[var(--foreground)]">
            info@calium.fun
          </p>
        </Section>

        <Section
          icon={<Shield className="h-6 w-6 text-[var(--primary)]" />}
          title="Telif Hakları (DMCA)"
        >
          <p>
            Calium, herhangi bir içeriği barındırmaz veya depolamaz. Tüm
            içerikler üçüncü taraf kaynaklardan temin edilmektedir. Telif hakkı
            ihlali ile ilgili bildirimlerinizi aşağıdaki adrese
            gönderebilirsiniz:
          </p>
          <p className="mt-2 font-medium text-[var(--foreground)]">
            dmca@calium.fun
          </p>
          <p className="mt-2 text-sm">
            Lütfen bildirminizde şu bilgileri yer verin: ihlal edilen içeriğin
            URL&apos;si, telif hakkı sahibi bilgileri ve yetki belgesi.
          </p>
        </Section>

        <Section
          icon={<Scale className="h-6 w-6 text-[var(--primary)]" />}
          title="Yasal Uyarı"
        >
          <p>
            Bu platform, içeriklerin telif haklarını sağlamaz ve bunlardan
            sorumlu değildir. Tüm haklar ilgili lisans sahiplerine aittir.
            Platform yalnızca üçüncü taraf API&apos;ler üzerinden içerik
            sunmaktadır.
          </p>
          <p className="mt-2">
            Kullanıcılar, platformu kullanarak bu şartları kabul etmiş sayılır.
            Platform içerikler üzerinde herhangi bir kontrol veya sorumluluk
            iddiasında bulunmamaktadır.
          </p>
        </Section>

        <Section
          icon={<Heart className="h-6 w-6 text-[var(--primary)]" />}
          title="Hakkımızda"
        >
          <p>
            Calium, kar amacı gütmeyen bir kişisel projedir. Geliştiriciler
            tarafından anime severler için ücretsiz olarak geliştirilmektedir.
            Hiçbir ticari gelir elde edilmemektedir.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/20">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-[var(--muted-foreground)]">
        {children}
      </div>
    </div>
  );
}
