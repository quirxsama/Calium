import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { updateRoomSchema } from "@/lib/social/room-schemas";
import { getRoomAccess } from "@/lib/social/rooms";
import { pushToUsers } from "@/lib/realtime/push";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }

  const acc = await getRoomAccess(session.sub, id);
  if (acc.access === "not_found") {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  if (acc.access === "ended") {
    return NextResponse.json({ success: false, error: "Oda kapandı." }, { status: 410 });
  }
  if (acc.access === "banned" || acc.access === "forbidden") {
    return NextResponse.json({ success: false, error: "Erişim yok." }, { status: 403 });
  }

  // Üye ve host bilgilerini hidrat et
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      members: {
        where: { banned: false },
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    room,
    isHost: acc.isHost,
    access: acc.access,
  });
}

/** Host: bölüm değiştirme, görünürlük güncelleme. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }
  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, hostId: true, endedAt: true },
  });
  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  if (room.hostId !== session.sub) {
    return NextResponse.json({ success: false, error: "Sadece host güncelleyebilir." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz gövde." }, { status: 400 });
  }
  const parsed = updateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar" }, { status: 400 });
  }

  const updated = await prisma.room.update({
    where: { id },
    data: {
      ...parsed.data,
      lastActiveAt: new Date(),
    },
    select: { episodeId: true, episodeName: true, isPublic: true },
  });

  // Oda üyelerine bölüm değişikliği bildir
  if (parsed.data.episodeId) {
    const members = await prisma.roomMember.findMany({
      where: { roomId: id, banned: false },
      select: { userId: true },
    });
    pushToUsers(
      members.map((m) => m.userId),
      {
        t: "room.update",
        roomId: id,
        episodeId: updated.episodeId,
        episodeName: updated.episodeName,
      }
    );
  }

  return NextResponse.json({ success: true, room: updated });
}

/** Host: odayı kapat. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }
  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, hostId: true, endedAt: true },
  });
  if (!room) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  if (room.hostId !== session.sub) {
    return NextResponse.json({ success: false, error: "Sadece host kapatabilir." }, { status: 403 });
  }
  if (room.endedAt) {
    return NextResponse.json({ success: true });
  }
  await prisma.room.update({
    where: { id },
    data: { endedAt: new Date() },
  });

  const members = await prisma.roomMember.findMany({
    where: { roomId: id, banned: false },
    select: { userId: true },
  });
  pushToUsers(members.map((m) => m.userId), { t: "room.closed", roomId: id });

  return NextResponse.json({ success: true });
}
