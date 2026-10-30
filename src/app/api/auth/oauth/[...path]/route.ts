import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, setSessionCookie } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/jwt";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import { configuration, digest, nonce, providers, seal, unseal, validVerifier } from "@/server/integrations/core.mjs";
import { identity, tokens } from "@/server/integrations/providers.mjs";
import { z } from "zod";

export const runtime = "nodejs";
const startSchema = z.object({ intent: z.enum(["login", "link", "reauth"]), platform: z.enum(["mobile", "web"]), challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
const exchangeSchema = z.object({ transactionId: z.string().min(1).max(100), verifier: z.string().min(43).max(128), cancel: z.boolean().optional() }).strict();
const cookieName = (id: string) => `oauth_${id}`;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const page = (ok: boolean) => new NextResponse(`<!doctype html><html lang="en"><head><meta name="referrer" content="no-referrer"><title>Calium</title></head><body><h1>${ok ? "Authorization complete" : "Authorization failed"}</h1><p>Return to Calium. You can close this window.</p></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" } });

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const limit = rateLimit(getClientIp(req), { bucket: "oauth", max: 60, windowMs: 60000 });
  if (!limit.ok) return fail("rate_limited", 429);
  let body: unknown;
  try { body = await req.json(); } catch { return fail("invalid_request"); }
  if (path.length === 1 && path[0] === "exchange") {
    const parsed = exchangeSchema.safeParse(body);
    if (!parsed.success) return fail("invalid_request");
    const { transactionId, verifier, cancel } = parsed.data;
    const transaction = await prisma.oAuthTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction || !validVerifier(verifier, transaction.challenge)) return fail("invalid_transaction", 403);
    if (transaction.expiresAt <= new Date()) return fail("expired", 410);
    if (cancel) {
      const result = await prisma.oAuthTransaction.updateMany({ where: { id: transactionId, status: { in: ["pending", "ready"] } }, data: { status: "cancelled", verifier: null } });
      return result.count ? NextResponse.json({ cancelled: true }) : fail("already_consumed", 409);
    }
    if (transaction.status === "pending" || transaction.status === "processing") return NextResponse.json({ pending: true }, { headers: { "Cache-Control": "no-store" } });
    if (transaction.status !== "ready" || !transaction.userId) return fail(transaction.error ?? transaction.status, transaction.status === "consumed" ? 409 : 400);
    const user = await prisma.user.findUnique({ where: { id: transaction.userId }, select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, bio: true, role: true, profilePublic: true, listsPublic: true, historyPublic: true, commentsPublic: true } });
    if (!user) return fail("invalid_transaction", 403);
    const token = transaction.intent === "login" ? await signToken(user.id, user.role) : null;
    const consumed = await prisma.oAuthTransaction.updateMany({ where: { id: transaction.id, status: "ready", expiresAt: { gt: new Date() } }, data: { status: "consumed", verifier: null } });
    if (!consumed.count) return fail("already_consumed", 409);
    const response = NextResponse.json(transaction.intent === "login" ? { success: true, token, user } : transaction.intent === "link" ? { linked: true } : { reauthenticated: true, reauthToken: transaction.id }, { headers: { "Cache-Control": "no-store" } });
    if (transaction.platform === "web" && token) response.cookies.set(setSessionCookie(token));
    return response;
  }
  if (path.length !== 2 || path[1] !== "start" || !providers.includes(path[0])) return fail("not_found", 404);
  const provider = path[0];
  const config = configuration(provider);
  if (!config.configured) return fail("integration_not_configured", 503);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return fail("invalid_request");
  const { intent, platform, challenge } = parsed.data;
  const user = await getCurrentUser();
  if (intent !== "login" && !user) return fail("unauthorized", 401);
  const origin = req.headers.get("origin");
  if (origin && origin !== config.origin) return fail("invalid_origin", 403);
  if (platform === "web" && origin !== config.origin) return fail("invalid_origin", 403);
  if (intent !== "login" && !origin && !req.headers.get("authorization")?.startsWith("Bearer ")) return fail("invalid_origin", 403);
  const state = nonce();
  const transaction = await prisma.oAuthTransaction.create({ data: { provider, intent, platform, challenge, stateHash: digest(state), userId: intent === "login" ? null : user!.id, verifier: provider === "mal" ? seal(nonce(), state) : null, expiresAt: new Date(Date.now() + 10 * 60000) } });
  return NextResponse.json({ authorizationUrl: `${config.origin}/api/auth/oauth/${provider}/authorize?state=${state}`, transactionId: transaction.id, expiresAt: transaction.expiresAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.length !== 2 || !providers.includes(path[0]) || !["authorize", "callback"].includes(path[1])) return fail("not_found", 404);
  const provider = path[0];
  const config = configuration(provider);
  if (!config.configured) return fail("integration_not_configured", 503);
  const state = req.nextUrl.searchParams.get("state");
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return page(false);
  const transaction = await prisma.oAuthTransaction.findUnique({ where: { stateHash: digest(state) } });
  if (!transaction || transaction.provider !== provider || transaction.expiresAt <= new Date() || transaction.status !== "pending") return page(false);
  if (path[1] === "authorize") {
    const browser = nonce();
    const bound = await prisma.oAuthTransaction.updateMany({ where: { id: transaction.id, browserHash: null, status: "pending" }, data: { browserHash: digest(browser) } });
    if (!bound.count) return page(false);
    const url = new URL(provider === "mal" ? "https://myanimelist.net/v1/oauth2/authorize" : "https://anilist.co/api/v2/oauth/authorize");
    url.search = new URLSearchParams({ response_type: "code", client_id: config.id!, redirect_uri: config.redirectUri, state, ...(provider === "mal" ? { code_challenge: unseal(transaction.verifier!, state), code_challenge_method: "plain" } : {}) }).toString();
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(cookieName(transaction.id), browser, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/oauth", maxAge: 600 });
    return response;
  }
  const browser = req.cookies.get(cookieName(transaction.id))?.value;
  if (!browser || digest(browser) !== transaction.browserHash) return page(false);
  const claimed = await prisma.oAuthTransaction.updateMany({ where: { id: transaction.id, status: "pending", expiresAt: { gt: new Date() } }, data: { status: "processing" } });
  if (!claimed.count) return page(false);
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (req.nextUrl.searchParams.has("error") || !code || code.length > 8192) throw new Error("authorization_denied");
    const credentials = await tokens(provider, { grant_type: "authorization_code", code, redirect_uri: config.redirectUri, ...(provider === "mal" ? { code_verifier: unseal(transaction.verifier!, state) } : {}) });
    const account = await identity(provider, credentials.access_token);
    await prisma.$transaction(async (db) => {
      const existing = await db.integration.findUnique({ where: { provider_providerUserId: { provider, providerUserId: account.id } } });
      if (transaction.intent !== "login" && existing && existing.userId !== transaction.userId) throw new Error("already_linked");
      if (transaction.intent === "reauth") {
        if (!existing || existing.userId !== transaction.userId) throw new Error("identity_mismatch");
        await db.oAuthTransaction.update({ where: { id: transaction.id }, data: { status: "ready", verifier: null } });
        return;
      }
      let userId = transaction.intent === "login" ? existing?.userId : transaction.userId;
      if (!userId) {
        const user = await db.user.create({ data: { username: `user_${nonce().slice(0, 20)}`, displayName: account.username } });
        userId = user.id;
      }
      const current = await db.integration.findUnique({ where: { userId_provider: { userId, provider } } });
      if (current && current.providerUserId !== account.id) throw new Error("provider_already_connected");
      if (current?.leaseUntil && current.leaseUntil > new Date()) throw new Error("integration_busy");
      const data = { providerUserId: account.id, username: account.username, credentials: seal(JSON.stringify(credentials), `${provider}:${userId}`), expiresAt: new Date(Date.now() + credentials.expires_in * 1000), status: "connected", error: null, nextRunAt: new Date(), attempts: 0 };
      await db.integration.upsert({ where: { userId_provider: { userId, provider } }, create: { userId, provider, ...data }, update: data });
      await db.oAuthTransaction.update({ where: { id: transaction.id }, data: { userId, status: "ready", verifier: null } });
    });
    const response = page(true);
    response.cookies.set(cookieName(transaction.id), "", { path: "/api/auth/oauth", maxAge: 0 });
    return response;
  } catch (error) {
    const allowed = ["authorization_denied", "already_linked", "identity_mismatch", "provider_already_connected", "integration_busy"];
    const message = error instanceof Error && allowed.includes(error.message) ? error.message : "authorization_failed";
    await prisma.oAuthTransaction.updateMany({ where: { id: transaction.id, status: "processing" }, data: { status: "failed", error: message, verifier: null } });
    return page(false);
  }
}
