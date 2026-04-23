const FALLBACK_SITE_URL = "https://calium.fun";

export function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || FALLBACK_SITE_URL;

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}
