import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { enqueue } from "@/server/integrations/worker.mjs";
import { normalizeEntry } from "@/server/integrations/core.mjs";
import { reconcileHistoryToLibrary } from "@/server/integrations/reconcile.mjs";
import { z } from "zod";

export const runtime = "nodejs";
const date = z.string().regex(/^\d{4}(-(?:0[1-9]|1[0-2]))?(-(?:0[1-9]|[12]\d|3[01]))?$/).nullable();
const valueSchema = z.object({ status: z.enum(["watching", "completed", "on_hold", "dropped", "plan_to_watch"]), progress: z.number().int().min(0).max(100000), score: z.number().int().min(0).max(100), repeat: z.number().int().min(0).max(10000), rewatching: z.boolean(), startedAt: date, completedAt: date, poster: z.string().nullable().optional() }).strict();
const schema = z.object({ id: z.string().max(100).optional(), version: z.number().int().positive().optional(), sourceId: z.string().min(1).max(200).optional(), title: z.string().min(1).max(500).optional(), totalEpisodes: z.number().int().positive().max(100000).nullable().optional(), malId: z.number().int().positive().nullable().optional(), anilistId: z.number().int().positive().nullable().optional(), confirmMapping: z.literal(true).optional(), value: valueSchema.partial().optional() }).strict();
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { path } = await context.params;
  if (path.join("/") !== "entries") return fail("not_found", 404);

  try {
    await reconcileHistoryToLibrary(user.id, prisma);
  } catch {}

  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const inactive = await prisma.trackingEntry.findMany({
    where: { userId: user.id, deleted: false, updatedAt: { lt: oneMonthAgo } },
  });
  for (const item of inactive) {
    const val = JSON.parse(item.value);
    if (val.status === "watching" && (!item.totalEpisodes || val.progress < item.totalEpisodes)) {
      val.status = "dropped";
      await prisma.trackingEntry.update({
        where: { id: item.id },
        data: { value: JSON.stringify(val), version: { increment: 1 } },
      });
      await enqueue(prisma, user.id);
    }
  }

  const entries = await prisma.trackingEntry.findMany({ where: { userId: user.id, deleted: false, sourceId: { not: null } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ entries: entries.map((entry) => ({ ...entry, value: JSON.parse(entry.value) })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { path } = await context.params;
  if (path.join("/") !== "entries") return fail("not_found", 404);
  let body: unknown;
  try { body = await req.json(); } catch { return fail("invalid_request"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("invalid_request");
  const data = parsed.data;
  if ((data.malId !== undefined || data.anilistId !== undefined) && !data.confirmMapping) return fail("mapping_confirmation_required");
  try {
    const entry = await prisma.$transaction(async (db) => {
      const existing = data.id ? await db.trackingEntry.findFirst({ where: { id: data.id, userId: user.id } }) : null;
      if (data.id && !existing) throw new Error("not_found");
      if (existing && existing.version !== data.version) throw new Error("version_conflict");
      if (existing && (data.malId !== undefined && data.malId !== existing.malId || data.anilistId !== undefined && data.anilistId !== existing.anilistId)) {
        const snapshots = await db.syncSnapshot.count({ where: { entryId: existing.id } });
        if (snapshots) throw new Error("mapping_in_use");
      }
      if (!existing && (!data.title || (!data.sourceId && !data.malId && !data.anilistId))) throw new Error("invalid_request");
      const value = normalizeEntry({ ...(existing ? JSON.parse(existing.value) : {}), ...data.value, totalEpisodes: data.totalEpisodes ?? existing?.totalEpisodes });
      const changes = { sourceId: data.sourceId, title: data.title, totalEpisodes: data.totalEpisodes, malId: data.malId, anilistId: data.anilistId, value: JSON.stringify(value), ...(data.confirmMapping ? { mapping: "confirmed" } : {}) };
      if (existing) return db.trackingEntry.update({ where: { id: existing.id, version: data.version }, data: { ...changes, version: { increment: 1 } } });
      return db.trackingEntry.create({ data: { userId: user.id, ...changes, title: data.title! } });
    });
    await enqueue(prisma, user.id);
    return NextResponse.json({ entry: { ...entry, value: JSON.parse(entry.value) } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return fail(["version_conflict", "mapping_in_use", "not_found", "invalid_request"].includes(code) ? code : "mapping_already_exists", 409);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { path } = await context.params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("invalid_request"); }
  if (path.join("/") === "progress") {
    const parsed = z.object({ entryId: z.string().max(100), version: z.number().int().positive(), completedEpisodes: z.number().int().min(0).max(100000) }).strict().safeParse(body);
    if (!parsed.success) return fail("invalid_request");
    const entry = await prisma.trackingEntry.findFirst({ where: { id: parsed.data.entryId, userId: user.id, deleted: false } });
    if (!entry) return fail("not_found", 404);
    const value = JSON.parse(entry.value);
    value.progress = Math.max(value.progress, parsed.data.completedEpisodes);
    if (entry.totalEpisodes && value.progress >= entry.totalEpisodes) value.status = "completed";
    else if (value.status === "plan_to_watch") value.status = "watching";
    const changed = await prisma.trackingEntry.updateMany({ where: { id: entry.id, version: parsed.data.version }, data: { value: JSON.stringify(value), version: { increment: 1 } } });
    if (!changed.count) return fail("version_conflict", 409);
    await enqueue(prisma, user.id);
    return NextResponse.json({ entry: { ...entry, value, version: entry.version + 1 } });
  }
  if (path.join("/") === "conflicts/resolve") {
    const parsed = z.object({ entryId: z.string().max(100), provider: z.enum(["mal", "anilist"]), version: z.number().int().min(0), entryVersion: z.number().int().positive(), choice: z.enum(["local", "remote"]), confirmDeletion: z.literal(true).optional() }).strict().safeParse(body);
    if (!parsed.success) return fail("invalid_request");
    const data = parsed.data;
    try {
      await prisma.$transaction(async (db) => {
        const entry = await db.trackingEntry.findFirst({ where: { id: data.entryId, userId: user.id } });
        const integration = await db.integration.findUnique({ where: { userId_provider: { userId: user.id, provider: data.provider } } });
        if (!entry || !integration) throw new Error("not_found");
        if (integration.leaseUntil && integration.leaseUntil > new Date()) throw new Error("integration_busy");
        const where = { integrationId_entryId: { integrationId: integration.id, entryId: entry.id } };
        const snapshot = await db.syncSnapshot.findUnique({ where });
        if (!snapshot?.conflict || snapshot.version !== data.version || entry.version !== data.entryVersion) throw new Error("version_conflict");
        const chosen = data.choice === "remote" ? snapshot.remote : entry.deleted ? null : entry.value;
        if (!chosen && !data.confirmDeletion) throw new Error("deletion_confirmation_required");
        if (!chosen && data.choice === "local" && snapshot.remote) throw new Error("remote_deletion_not_supported");
        await db.trackingEntry.update({ where: { id: entry.id }, data: { ...(chosen ? { value: chosen } : {}), deleted: !chosen, version: { increment: 1 } } });
        await db.syncSnapshot.update({ where, data: { base: snapshot.remote, conflict: null, version: { increment: 1 } } });
      });
      await enqueue(prisma, user.id);
      return NextResponse.json({ resolved: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : "resolve_failed";
      return fail(["not_found", "integration_busy", "version_conflict", "deletion_confirmation_required", "remote_deletion_not_supported"].includes(code) ? code : "resolve_failed", 409);
    }
  }
  return fail("not_found", 404);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const { path } = await context.params;
  if (path.join("/") !== "entries") return fail("not_found", 404);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("invalid_request"); }
  const parsed = z.object({ id: z.string().min(1).max(100) }).safeParse(body);
  if (!parsed.success) return fail("invalid_request");

  const entry = await prisma.trackingEntry.findFirst({
    where: { id: parsed.data.id, userId: user.id },
  });
  if (!entry) return fail("not_found", 404);

  await prisma.trackingEntry.update({
    where: { id: entry.id },
    data: { deleted: true, version: { increment: 1 } },
  });
  await enqueue(prisma, user.id);
  return NextResponse.json({ success: true });
}
