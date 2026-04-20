// WS için JWT doğrulama (cookie'den)
import { jwtVerify } from "jose";

const COOKIE_NAME = "calium_session";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function getSecret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(raw);
}

/** Returns { userId, role } or null. */
export async function authenticateRequest(req) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload?.sub) return null;
    return { userId: String(payload.sub), role: String(payload.role ?? "user") };
  } catch {
    return null;
  }
}
