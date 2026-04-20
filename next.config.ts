import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // `unoptimized: true` olduğundan remotePatterns etkisizdir; ileride
    // optimizer açılırsa gerçek whitelist'i yazmak için sade tutuldu.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.anizium.co" },
      { protocol: "https", hostname: "**.anizium.com" },
      { protocol: "https", hostname: "**.anizium.net" },
      { protocol: "https", hostname: "**.anizium.org" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
