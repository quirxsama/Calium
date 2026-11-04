const ANIZIUM_ASSET_PROXY_PATH = "/api/anizium/asset";

const ALLOWED_ANIZIUM_HOSTS = [
  "anizium.co",
  "anizium.com",
  "anizium.net",
  "anizium.org",
  "aniziumserver.sbs",
  "aniziumserver.site",
];

export function isAniziumAssetUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith(ANIZIUM_ASSET_PROXY_PATH)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      ALLOWED_ANIZIUM_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

export function toAniziumAssetProxyUrl<T extends string | null | undefined>(value: T): T {
  if (!isAniziumAssetUrl(value)) return value;
  return `${ANIZIUM_ASSET_PROXY_PATH}?url=${encodeURIComponent(value)}` as T;
}

export function toAbsoluteAniziumAssetProxyUrl(value: string | null | undefined, origin: string) {
  const proxied = toAniziumAssetProxyUrl(value);
  if (!proxied) return proxied;
  if (proxied.startsWith("/")) return new URL(proxied, origin).toString();
  return proxied;
}
