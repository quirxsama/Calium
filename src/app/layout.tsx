import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Noto_Sans, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { InviteToast } from "@/components/social/invite-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Caption font choices — loaded globally so they're available for the player caption renderer.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Calium v0.6 — Ücretsiz Anime İzleme Platformu",
  description:
    "Calium v0.6: Binlerce anime ve filmi Türkçe altyazı ve dublaj ile ücretsiz izle.",
  keywords: ["anime", "anime izle", "türkçe altyazılı anime", "türkçe dublaj anime", "calium"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Calium",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    // `src/app/favicon.ico` Next convention ile otomatik yüklenir. Burada sadece
    // ek web/apple ikonları deklare edilir.
    icon: [{ url: "/icon.webp", type: "image/webp" }],
    apple: [{ url: "/icon.webp" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${notoSans.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          <RealtimeProvider />
          <InviteToast />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
