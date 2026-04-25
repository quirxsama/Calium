import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.anizium.co" },
      { protocol: "https", hostname: "**.anizium.com" },
      { protocol: "https", hostname: "**.anizium.net" },
      { protocol: "https", hostname: "**.anizium.org" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "wsrv.nl" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  allowedDevOrigins: ['192.168.1.108'],

};

export default nextConfig;
