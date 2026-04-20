import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createRoomSchema } from "@/lib/social/room-schemas";
import { generateRoomCode } from "@/lib/social/rooms";

/** Oda oluştur. Host otomatik üye olur. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz gövde." }, { status: 400 });
  }
  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Geçersiz alanlar", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const code = await generateRoomCode();
  const room = await prisma.room.create({
    data: {
      code,
      hostId: session.sub,
      animeId: parsed.data.animeId,
      animeName: parsed.data.animeName,
      episodeId: parsed.data.episodeId,
      episodeName: parsed.data.episodeName ?? null,
      poster: parsed.data.poster ?? null,
      isPublic: parsed.data.isPublic ?? false,
      members: {
        create: { userId: session.sub, role: "host" },
      },
    },
    select: { id: true, code: true },
  });

  return NextResponse.json({ success: true, room });
}

/** Kullanıcının içinde olduğu aktif odaları (host veya üye) listeler. */
export async function GET() {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }
  const rooms = await prisma.room.findMany({
    where: {
      endedAt: null,
      OR: [
        { hostId: session.sub },
        { members: { some: { userId: session.sub, banned: false } } },
      ],
    },
    orderBy: { lastActiveAt: "desc" },
    take: 20,
    select: {
      id: true,
      code: true,
      hostId: true,
      animeId: true,
      animeName: true,
      episodeId: true,
      episodeName: true,
      poster: true,
      isPublic: true,
      lastActiveAt: true,
      _count: { select: { members: true } },
    },
  });
  return NextResponse.json({ success: true, rooms });
}
