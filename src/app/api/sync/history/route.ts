import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

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

  const items = (body as { history?: Array<{
    animeId: string; animeName: string; poster?: string | null;
    episodeId: string; episodeName: string; episodeNumber?: number | null;
    seasonNumber?: number | null; progress: number; duration: number; updatedAt: number;
  }> }).history;

  if (!Array.isArray(items)) {
    return NextResponse.json({ success: false, error: "history dizisi bekleniyor." }, { status: 400 });
  }

  for (const item of items) {
    const existing = await prisma.historyItem.findUnique({
      where: { userId_animeId: { userId: user!.id, animeId: item.animeId } },
    });

    const incomingDate = new Date(item.updatedAt);

    if (existing && existing.updatedAt >= incomingDate) continue;

    await prisma.historyItem.upsert({
      where: { userId_animeId: { userId: user!.id, animeId: item.animeId } },
      update: {
        animeName: item.animeName,
        poster: item.poster ?? null,
        episodeId: item.episodeId,
        episodeName: item.episodeName,
        episodeNumber: item.episodeNumber ?? null,
        seasonNumber: item.seasonNumber ?? null,
        progress: item.progress,
        duration: item.duration,
        updatedAt: incomingDate,
      },
      create: {
        userId: user!.id,
        animeId: item.animeId,
        animeName: item.animeName,
        poster: item.poster ?? null,
        episodeId: item.episodeId,
        episodeName: item.episodeName,
        episodeNumber: item.episodeNumber ?? null,
        seasonNumber: item.seasonNumber ?? null,
        progress: item.progress,
        duration: item.duration,
        updatedAt: incomingDate,
      },
    });
  }

  return NextResponse.json({ success: true });
}
