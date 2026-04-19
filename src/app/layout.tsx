import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Noto_Sans, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

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
  title: "Calium — Ücretsiz Anime İzleme Platformu",
  description:
    "Binlerce anime ve filmi Türkçe altyazı ve dublaj ile ücretsiz izle.",
  keywords: ["anime", "anime izle", "türkçe altyazılı anime", "türkçe dublaj anime", "calium"],
  icons: {
    icon: [
      { url: "/icons/icon_16x16.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/icons/icon_32x32.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icons/icon_48x48.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icons/icon_64x64.ico", sizes: "64x64", type: "image/x-icon" },
      { url: "/icons/icon_128x128.ico", sizes: "128x128", type: "image/x-icon" },
      { url: "/icons/icon_256x256.ico", sizes: "256x256", type: "image/x-icon" },
      { url: "/icon.webp", type: "image/webp" },
    ],
    shortcut: "/icons/icon_32x32.ico",
    apple: [{ url: "/icon.webp" }],
  },
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
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
