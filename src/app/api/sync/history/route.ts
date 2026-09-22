import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { reconcileHistoryToLibrary } from "@/lib/tracking-history";
import { enqueue } from "@/server/integrations/worker.mjs";

const HistoryItemSchema = z.object({
  animeId: z.string().min(1).max(64),
  animeName: z.string().min(1).max(300),
  poster: z.string().max(1000).nullable().optional(),
  episodeId: z.string().min(1).max(64),
  episodeName: z.string().min(1).max(300),
  episodeNumber: z.number().nullable().optional(),
  seasonNumber: z.number().nullable().optional(),
  progress: z.number().nonnegative().max(100_000),
  duration: z.number().nonnegative().max(100_000),
  updatedAt: z.number().int().nonnegative().max(8640000000000000),
  completedEpisodes: z.number().int().min(0).max(100000).nullable().optional(),
  totalEpisodes: z.number().int().positive().max(100000).nullable().optional(),
  pendingNext: z.boolean().optional(),
});

const HistoryBodySchema = z.object({
  history: z.array(HistoryItemSchema).max(500),
});

const DeleteHistoryBodySchema = z.object({
  animeIds: z.array(z.string().min(1).max(64)).max(500).optional(),
  all: z.boolean().optional(),
});

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const history = await prisma.historyItem.findMany({
    where: { userId: user!.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      animeId: true,
      animeName: true,
      poster: true,
      episodeId: true,
      episodeName: true,
      episodeNumber: true,
      seasonNumber: true,
      progress: true,
      duration: true,
      completedEpisodes: true,
      totalEpisodes: true,
      pendingNext: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    history: history.map((h) => ({
      animeId: h.animeId,
      animeName: h.animeName,
      poster: h.poster,
      episodeId: h.episodeId,
      episodeName: h.episodeName,
      episodeNumber: h.episodeNumber,
      seasonNumber: h.seasonNumber,
      progress: h.progress,
      duration: h.duration,
      completedEpisodes: h.completedEpisodes,
      totalEpisodes: h.totalEpisodes,
      pendingNext: h.pendingNext,
      updatedAt: h.updatedAt.getTime(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = HistoryBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz geçmiş verisi." },
      { status: 400 }
    );
  }

  const items = parsed.data.history;
  if (items.length === 0) return NextResponse.json({ success: true });

  await prisma.$transaction(async (db) => {
    for (const item of items) {
      const incomingDate = new Date(Math.min(item.updatedAt, Date.now()));
      const existing = await db.historyItem.findUnique({ where: { userId_animeId: { userId: user!.id, animeId: item.animeId } } });
      if (existing && existing.updatedAt >= incomingDate) continue;
      const data = {
        animeName: item.animeName,
        poster: item.poster ?? null,
        episodeId: item.episodeId,
        episodeName: item.episodeName,
        episodeNumber: item.episodeNumber ?? null,
        seasonNumber: item.seasonNumber ?? null,
        progress: item.progress,
        duration: item.duration,
        completedEpisodes: item.completedEpisodes ?? null,
        totalEpisodes: item.totalEpisodes ?? null,
        pendingNext: item.pendingNext ?? false,
        updatedAt: incomingDate,
      };
      await db.historyItem.upsert({
        where: { userId_animeId: { userId: user!.id, animeId: item.animeId } },
        update: data,
        create: { userId: user!.id, animeId: item.animeId, ...data },
      });
    }
  });

  try {
    await reconcileHistoryToLibrary(user!.id);
    await enqueue(prisma, user!.id);
  } catch {}

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = DeleteHistoryBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz geçmiş verisi." },
      { status: 400 }
    );
  }

  const { all, animeIds = [] } = parsed.data;
  if (all) {
    await prisma.historyItem.deleteMany({ where: { userId: user!.id } });
    return NextResponse.json({ success: true });
  }

  const uniqueAnimeIds = [...new Set(animeIds)];
  if (uniqueAnimeIds.length === 0) return NextResponse.json({ success: true });

  await prisma.historyItem.deleteMany({
    where: { userId: user!.id, animeId: { in: uniqueAnimeIds } },
  });

  return NextResponse.json({ success: true });
}
