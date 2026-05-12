import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

const FavoriteItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(300),
  poster: z.string().max(1000).nullable().optional(),
  addedAt: z.number().int().nonnegative(),
});

const FavoritesBodySchema = z.object({
  favorites: z.array(FavoriteItemSchema).max(500),
});

const DeleteFavoritesBodySchema = z.object({
  animeIds: z.array(z.string().min(1).max(64)).max(500).optional(),
  all: z.boolean().optional(),
});

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

  const parsed = FavoritesBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz favori verisi." },
      { status: 400 }
    );
  }

  const items = parsed.data.favorites;

  await prisma.$transaction(
    items.map((item) =>
      prisma.favorite.upsert({
        where: { userId_animeId: { userId: user!.id, animeId: item.id } },
        update: { name: item.name, poster: item.poster ?? null },
        create: {
          userId: user!.id,
          animeId: item.id,
          name: item.name,
          poster: item.poster ?? null,
          addedAt: new Date(item.addedAt),
        },
      })
    )
  );

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

  const parsed = DeleteFavoritesBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz favori verisi." },
      { status: 400 }
    );
  }

  const { all, animeIds = [] } = parsed.data;
  if (all) {
    await prisma.favorite.deleteMany({ where: { userId: user!.id } });
    return NextResponse.json({ success: true });
  }

  const uniqueAnimeIds = [...new Set(animeIds)];
  if (uniqueAnimeIds.length === 0) return NextResponse.json({ success: true });

  await prisma.favorite.deleteMany({
    where: { userId: user!.id, animeId: { in: uniqueAnimeIds } },
  });

  return NextResponse.json({ success: true });
}
