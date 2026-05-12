import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calium — Anime İzleme Platformu",
    short_name: "Calium",
    description: "Binlerce anime ve filmi Türkçe altyazı ve dublaj ile ücretsiz izle.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    background_color: "#0a0a0c",
    theme_color: "#f43f5e",
    orientation: "any",
    lang: "tr-TR",
    dir: "ltr",
    categories: ["entertainment", "video", "tv"],
    prefer_related_applications: false,
    launch_handler: {
      client_mode: ["focus-existing", "navigate-existing"],
    },
    icons: [
      {
        src: "/icons/icon_48x48.ico",
        sizes: "48x48",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Keşfet",
        short_name: "Keşfet",
        description: "Yeni animeleri keşfet",
        url: "/kesfet?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "İzlemeye Devam Et",
        short_name: "Devam Et",
        description: "Kaldığın yerden izlemeye devam et",
        url: "/?source=pwa-shortcut#izlemeye-devam",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Favoriler",
        short_name: "Favoriler",
        description: "Favori animelerini aç",
        url: "/favoriler?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Yayın Takvimi",
        short_name: "Takvim",
        description: "Yeni bölüm yayın takvimini aç",
        url: "/yayin-takvimi?source=pwa-shortcut",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
