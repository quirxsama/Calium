import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { inviteRespondSchema, joinByCodeSchema } from "@/lib/social/room-schemas";
import { findRoomByCode, getRoomAccess, normalizeRoomCode } from "@/lib/social/rooms";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = joinByCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz oda kodu." }, { status: 400 });
  }

  const room = await findRoomByCode(parsed.data.code);
  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }

  const access = await getRoomAccess(user!.id, room.id);
  if (access.access === "banned") {
    return NextResponse.json({ success: false, error: "Bu odaya erişimin yok." }, { status: 403 });
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: user!.id } },
    update: { leftAt: null, banned: false, role: access.isHost ? "host" : "guest" },
    create: { roomId: room.id, userId: user!.id, role: access.isHost ? "host" : "guest" },
  });

  await prisma.room.update({ where: { id: room.id }, data: { lastActiveAt: new Date() } });

  return NextResponse.json({
    success: true,
    room: { id: room.id, code: room.code, inviteUrl: `/oda/${room.id}?code=${encodeURIComponent(room.code)}` },
  });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = inviteRespondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz işlem." }, { status: 400 });
  }

  const invite = parsed.data.inviteId
    ? await prisma.roomInvite.findFirst({
        where: { id: parsed.data.inviteId, inviteeId: user!.id, status: "pending" },
        select: { id: true, roomId: true, room: { select: { code: true, endedAt: true } } },
      })
    : null;

  if (!invite) {
    return NextResponse.json({ success: false, error: "Davet bulunamadı." }, { status: 404 });
  }

  if (invite.room.endedAt) {
    await prisma.roomInvite.update({ where: { id: invite.id }, data: { status: "expired" } });
    return NextResponse.json({ success: false, error: "Oda kapandı." }, { status: 410 });
  }

  if (parsed.data.action === "decline") {
    await prisma.roomInvite.update({ where: { id: invite.id }, data: { status: "declined" } });
    return NextResponse.json({ success: true, status: "declined" });
  }

  await prisma.$transaction([
    prisma.roomInvite.update({ where: { id: invite.id }, data: { status: "accepted" } }),
    prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: invite.roomId, userId: user!.id } },
      update: { leftAt: null, banned: false, role: "guest" },
      create: { roomId: invite.roomId, userId: user!.id, role: "guest" },
    }),
    prisma.room.update({ where: { id: invite.roomId }, data: { lastActiveAt: new Date() } }),
  ]);

  return NextResponse.json({
    success: true,
    status: "accepted",
    room: {
      id: invite.roomId,
      code: normalizeRoomCode(invite.room.code),
      inviteUrl: `/oda/${invite.roomId}?code=${encodeURIComponent(invite.room.code)}`,
    },
  });
}
