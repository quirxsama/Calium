import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { roomRequestSchema } from "@/lib/social/room-schemas";
import { areFriends, isEitherBlocked, isFollowing } from "@/lib/social/friends";
import { createNotification } from "@/lib/social/notifications";
import { findRoomByCode } from "@/lib/social/rooms";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = roomRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar." }, { status: 400 });
  }

  const { targetUserId } = parsed.data;
  if (targetUserId === user!.id) {
    return NextResponse.json({ success: false, error: "Kendine istek gönderemezsin." }, { status: 400 });
  }

  const [friends, following] = await Promise.all([
    areFriends(user!.id, targetUserId),
    isFollowing(user!.id, targetUserId),
  ]);
  if (!friends && !following) {
    return NextResponse.json({ success: false, error: "Bu kullanıcıya istek gönderemezsin." }, { status: 403 });
  }
  if (await isEitherBlocked(user!.id, targetUserId)) {
    return NextResponse.json({ success: false, error: "Bu kullanıcıya istek gönderemezsin." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, dndEnabled: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (target.dndEnabled) {
    return NextResponse.json({ success: false, error: "Kullanıcı rahatsız etme modunda." }, { status: 409 });
  }

  let roomId = parsed.data.roomId;
  let roomCode = parsed.data.roomCode;
  let roomAnimeName = parsed.data.animeName;
  let roomInviteUrl: string | null = null;
  if (!roomId && roomCode) {
    const room = await findRoomByCode(roomCode);
    if (!room || room.endedAt) {
      return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
    }
    roomId = room.id;
    roomCode = room.code;
    roomInviteUrl = `/oda/${room.id}?code=${encodeURIComponent(room.code)}`;
  }

  if (!roomId && parsed.data.animeId && parsed.data.animeName && parsed.data.episodeId) {
    const code = await prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          code: Math.random().toString(36).slice(2, 8).toUpperCase(),
          hostId: user!.id,
          animeId: parsed.data.animeId!,
          animeName: parsed.data.animeName!,
          episodeId: parsed.data.episodeId!,
          episodeName: parsed.data.episodeName ?? null,
          poster: parsed.data.poster ?? null,
          isPublic: false,
          members: { create: { userId: user!.id, role: "host" } },
        },
        select: { id: true, code: true, animeName: true },
      });
      return room;
    });
    roomId = code.id;
    roomCode = code.code;
    roomAnimeName = code.animeName;
    roomInviteUrl = `/oda/${code.id}?code=${encodeURIComponent(code.code)}`;
  }

  if (!roomId) {
    return NextResponse.json({ success: false, error: "Oda bilgisi gerekli." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      code: true,
      animeName: true,
      endedAt: true,
      hostId: true,
      members: { where: { userId: user!.id, banned: false }, select: { userId: true } },
      host: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }

  const isMember = room.hostId === user!.id || room.members.length > 0;
  if (!isMember) {
    return NextResponse.json({ success: false, error: "Bu oda için istek gönderemezsin." }, { status: 403 });
  }

  await createNotification(targetUserId, "room_request", {
    roomId: room.id,
    roomCode: room.code,
    inviteUrl: roomInviteUrl ?? `/oda/${room.id}?code=${encodeURIComponent(room.code)}`,
    animeName: roomAnimeName ?? room.animeName,
    requesterId: user!.id,
    username: room.host.username,
    displayName: room.host.displayName,
    avatarUrl: room.host.avatarUrl,
  });

  return NextResponse.json({ success: true });
}
