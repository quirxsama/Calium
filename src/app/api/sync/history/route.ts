import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

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
  updatedAt: z.number().int().nonnegative(),
});

const HistoryBodySchema = z.object({
  history: z.array(HistoryItemSchema).max(500),
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

  // Mevcut kayıtları tek sorguyla çek (N+1 yerine 1).
  const animeIds = items.map((i) => i.animeId);
  const existing = await prisma.historyItem.findMany({
    where: { userId: user!.id, animeId: { in: animeIds } },
    select: { animeId: true, updatedAt: true },
  });
  const existingMap = new Map(existing.map((e) => [e.animeId, e.updatedAt]));

  // Sadece client'ta daha yeni olanları upsert'le.
  const toWrite = items.filter((item) => {
    const existingAt = existingMap.get(item.animeId);
    return !existingAt || existingAt < new Date(item.updatedAt);
  });

  if (toWrite.length === 0) return NextResponse.json({ success: true });

  await prisma.$transaction(
    toWrite.map((item) => {
      const incomingDate = new Date(item.updatedAt);
      const data = {
        animeName: item.animeName,
        poster: item.poster ?? null,
        episodeId: item.episodeId,
        episodeName: item.episodeName,
        episodeNumber: item.episodeNumber ?? null,
        seasonNumber: item.seasonNumber ?? null,
        progress: item.progress,
        duration: item.duration,
        updatedAt: incomingDate,
      };
      return prisma.historyItem.upsert({
        where: { userId_animeId: { userId: user!.id, animeId: item.animeId } },
        update: data,
        create: { userId: user!.id, animeId: item.animeId, ...data },
      });
    })
  );

  return NextResponse.json({ success: true });
}
