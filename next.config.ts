import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.anizium.co" },
      { protocol: "https", hostname: "**.anizium.com" },
      { protocol: "https", hostname: "**.anizium.net" },
      { protocol: "https", hostname: "**.anizium.org" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
