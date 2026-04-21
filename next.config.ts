import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    qualities: [25, 50, 75, 100],
    remotePatterns: [
      { protocol: "https", hostname: "**.anizium.co" },
      { protocol: "https", hostname: "**.anizium.com" },
      { protocol: "https", hostname: "**.anizium.net" },
      { protocol: "https", hostname: "**.anizium.org" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "i.imgur.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  allowedDevOrigins: ['192.168.1.108'],

};

export default nextConfig;
