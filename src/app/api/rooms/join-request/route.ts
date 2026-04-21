import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { joinRequestSchema, joinRequestRespondSchema } from "@/lib/social/room-schemas";
import { createNotification } from "@/lib/social/notifications";
import { isEitherBlocked } from "@/lib/social/friends";
import { normalizeRoomCode } from "@/lib/social/rooms";

/**
 * POST — Odaya katılma isteği gönderir.
 * Public oda ise direkt giriş bilgisi döner, private ise host'a bildirim gider.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = joinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { id: parsed.data.roomId },
    select: {
      id: true,
      code: true,
      hostId: true,
      isPublic: true,
      endedAt: true,
      animeName: true,
      members: { where: { userId: user!.id }, select: { userId: true, banned: true } },
      host: { select: { id: true, username: true, displayName: true, avatarUrl: true, dndEnabled: true } },
    },
  });

  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }

  const member = room.members[0];
  const isBanned = Boolean(member?.banned);

  if (await isEitherBlocked(user!.id, room.hostId)) {
    return NextResponse.json({ success: false, error: "Bu odaya erişimin yok." }, { status: 403 });
  }

  // Zaten üye veya host ise doğrudan giriş
  if (room.hostId === user!.id || (member && !isBanned)) {
    return NextResponse.json({
      success: true,
      direct: true,
      roomUrl: `/oda/${room.id}?code=${encodeURIComponent(room.code)}`,
    });
  }

  // Public oda → banlı değilse doğrudan katıl
  if (room.isPublic && !isBanned) {
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user!.id } },
      update: { leftAt: null, banned: false, role: "guest" },
      create: { roomId: room.id, userId: user!.id, role: "guest" },
    });
    return NextResponse.json({
      success: true,
      direct: true,
      roomUrl: `/oda/${room.id}?code=${encodeURIComponent(room.code)}`,
    });
  }

  // Private oda → host'a bildirim gönder
  await createNotification(room.hostId, "room_join_request", {
    roomId: room.id,
    roomCode: room.code,
    animeName: room.animeName,
    requesterId: user!.id,
    username: user!.username,
    displayName: user!.displayName,
    avatarUrl: user!.avatarUrl,
  });

  return NextResponse.json({ success: true, direct: false });
}

/**
 * PATCH — Host, katılma isteğini kabul/reddet.
 */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = joinRequestRespondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar." }, { status: 400 });
  }

  const { notificationId, requesterId, roomId, action } = parsed.data;

  // Host olduğunu kontrol et
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, code: true, hostId: true, endedAt: true, animeName: true },
  });

  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  if (room.hostId !== user!.id) {
    return NextResponse.json({ success: false, error: "Sadece host yanıtlayabilir." }, { status: 403 });
  }

  // Bildirimi okundu yap
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user!.id },
    data: { readAt: new Date() },
  });

  if (action === "decline") {
    return NextResponse.json({ success: true, action: "declined" });
  }

  // Kabul: kullanıcıyı odaya ekle
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: requesterId } },
    update: { leftAt: null, banned: false, role: "guest" },
    create: { roomId: room.id, userId: requesterId, role: "guest" },
  });

  // İstek sahibine bildirim gönder
  await createNotification(requesterId, "room_join_accepted", {
    roomId: room.id,
    roomCode: room.code,
    animeName: room.animeName,
    inviteUrl: `/oda/${room.id}?code=${encodeURIComponent(normalizeRoomCode(room.code))}`,
    username: user!.username,
    displayName: user!.displayName,
    avatarUrl: user!.avatarUrl,
  });

  return NextResponse.json({ success: true, action: "accepted" });
}
