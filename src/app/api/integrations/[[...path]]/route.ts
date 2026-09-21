import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { configuration, providers } from "@/server/integrations/core.mjs";
import { enqueue } from "@/server/integrations/worker.mjs";
import { verifyPassword } from "@/lib/auth/password";
import { z } from "zod";

export const runtime = "nodejs";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const user = await getCurrentUser();
  const connections = user ? await prisma.integration.findMany({ where: { userId: user.id }, select: { provider: true, username: true, status: true, lastSyncedAt: true, error: true } }) : [];
  const entries = user ? await prisma.trackingEntry.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }) : [];
  const conflicts = user ? await prisma.syncSnapshot.findMany({ where: { integration: { userId: user.id }, conflict: { not: null } }, select: { entryId: true, remote: true, base: true, conflict: true, version: true, integration: { select: { provider: true } } } }) : [];
  return NextResponse.json({ connections: providers.map((provider) => ({ provider, connected: false, username: null, status: "disconnected", lastSyncedAt: null, error: null, ...connections.find((item) => item.provider === provider), ...(connections.some((item) => item.provider === provider) ? { connected: true } : {}), configured: configuration(provider).configured, capabilities: { datesWrite: provider !== "mal", scoreStep: provider === "mal" ? 10 : 1 } })), entries: entries.map((entry) => ({ ...entry, value: JSON.parse(entry.value) })), conflicts: conflicts.map((item) => ({ entryId: item.entryId, provider: item.integration.provider, version: item.version, fields: JSON.parse(item.conflict!), base: item.base ? JSON.parse(item.base) : null, remote: item.remote ? JSON.parse(item.remote) : null })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { path = [] } = await context.params;
  if (path.length === 1 && path[0] === "sync") {
    await enqueue(prisma, user.id);
    return NextResponse.json({ queued: true }, { status: 202 });
  }
  return fail("not_found", 404);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { path = [] } = await context.params;
  if (path.length !== 1 || !providers.includes(path[0])) return fail("not_found", 404);
  let body: unknown;
  try { body = await req.json(); } catch { return fail("invalid_request"); }
  const parsed = z.object({ password: z.string().max(200).optional(), reauthToken: z.string().max(100).optional() }).strict().safeParse(body);
  if (!parsed.success) return fail("invalid_request");
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const passwordValid = !!account?.passwordHash && !!parsed.data.password && await verifyPassword(parsed.data.password, account.passwordHash);
  try {
    await prisma.$transaction(async (db) => {
      if (!passwordValid) {
        if (!parsed.data.reauthToken) throw new Error("reauth_required");
        const consumed = await db.oAuthTransaction.updateMany({ where: { id: parsed.data.reauthToken, userId: user.id, intent: "reauth", status: "consumed", expiresAt: { gt: new Date() } }, data: { status: "used" } });
        if (!consumed.count) throw new Error("reauth_required");
      }
      const count = await db.integration.count({ where: { userId: user.id } });
      if (!account?.passwordHash && count <= 1) throw new Error("last_login_method");
      const integration = await db.integration.findUnique({ where: { userId_provider: { userId: user.id, provider: path[0] } } });
      if (integration?.leaseUntil && integration.leaseUntil > new Date()) throw new Error("integration_busy");
      await db.integration.deleteMany({ where: { userId: user.id, provider: path[0] } });
    });
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "disconnect_failed";
    return fail(["reauth_required", "last_login_method", "integration_busy"].includes(code) ? code : "disconnect_failed", 409);
  }
}
