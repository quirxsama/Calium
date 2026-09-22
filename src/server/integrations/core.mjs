import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const providers = ["mal", "anilist"];
export const fields = ["status", "progress", "score", "repeat", "rewatching", "startedAt", "completedAt"];
export const digest = (value) => createHash("sha256").update(value).digest("base64url");
export const nonce = () => randomBytes(32).toString("base64url");
export function validVerifier(verifier, challenge) {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = Buffer.from(digest(verifier));
  const expected = Buffer.from(challenge);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function getKey(key = process.env.OAUTH_ENCRYPTION_KEY) {
  if (key) {
    const buf = Buffer.from(key, "base64");
    if (buf.length === 32) return buf;
  }
  if (process.env.JWT_SECRET) {
    return createHash("sha256").update(process.env.JWT_SECRET).digest();
  }
  if (process.env.NODE_ENV !== "production") {
    return createHash("sha256").update("calium_dev_encryption_key").digest();
  }
  return null;
}
export function seal(value, context, key) {
  const bytes = key ? (Buffer.isBuffer(key) ? key : Buffer.from(key, "base64")) : getKey();
  if (!bytes || bytes.length !== 32) throw new Error("integration_not_configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", bytes, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(value, context, key) {
  const bytes = key ? (Buffer.isBuffer(key) ? key : Buffer.from(key, "base64")) : getKey();
  if (!bytes || bytes.length !== 32) throw new Error("integration_not_configured");
  const raw = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", bytes, raw.subarray(0, 12));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString("utf8");
}
export function normalizeEntry(value) {
  return {
    status: value.status ?? (value.totalEpisodes > 0 && value.progress >= value.totalEpisodes ? "completed" : "watching"),
    progress: value.progress ?? 0,
    score: value.score ?? 0,
    repeat: value.repeat ?? 0,
    rewatching: value.rewatching ?? false,
    startedAt: value.startedAt ?? null,
    completedAt: value.completedAt ?? null,
    poster: value.poster ?? null,
  };
}
export function mergeEntry(base, local, remote, syncFields = fields) {
  if (base && (!local || !remote)) return { value: local, conflicts: ["deletion"], deletion: true };
  if (!local || !remote) return { value: local ?? remote, conflicts: [] };
  const value = { ...local };
  const conflicts = [];
  for (const field of syncFields) {
    if (local[field] === remote[field]) continue;
    if (base && local[field] === base[field]) value[field] = remote[field];
    else if (!base || remote[field] !== base[field]) conflicts.push(field);
  }
  return { value, conflicts };
}
export function configuration(provider) {
  const prefix = provider === "mal" ? "MAL" : "ANILIST";
  const origin = process.env.OAUTH_PUBLIC_ORIGIN || (process.env.NODE_ENV !== "production" ? `http://localhost:${process.env.PORT ?? 3000}` : "");
  const id = process.env[`${prefix}_CLIENT_ID`];
  const secret = process.env[`${prefix}_CLIENT_SECRET`];
  let validOrigin = false;
  try {
    const url = new URL(origin);
    validOrigin = (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")));
  } catch {}
  const key = getKey();
  const configured = providers.includes(provider) && validOrigin && !!id && !!secret && !!key;
  return { configured, id, secret, origin, redirectUri: `${origin}/api/auth/oauth/${provider}/callback` };
}
