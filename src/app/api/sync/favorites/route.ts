import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const favorites = await prisma.favorite.findMany({
    where: { userId: user!.id },
    orderBy: { addedAt: "desc" },
    select: { animeId: true, name: true, poster: true, addedAt: true },
  });

  return NextResponse.json({
    success: true,
    favorites: favorites.map((f) => ({
      id: f.animeId,
      name: f.name,
      poster: f.poster,
      addedAt: f.addedAt.getTime(),
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

  const items = (body as { favorites?: Array<{ id: string; name: string; poster?: string | null; addedAt: number }> }).favorites;
  if (!Array.isArray(items)) {
    return NextResponse.json({ success: false, error: "favorites dizisi bekleniyor." }, { status: 400 });
  }

  for (const item of items) {
    await prisma.favorite.upsert({
      where: { userId_animeId: { userId: user!.id, animeId: item.id } },
      update: { name: item.name, poster: item.poster ?? null },
      create: {
        userId: user!.id,
        animeId: item.id,
        name: item.name,
        poster: item.poster ?? null,
        addedAt: new Date(item.addedAt),
      },
    });
  }

  return NextResponse.json({ success: true });
}
