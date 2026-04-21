import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { offlineInviteSchema, offlineInviteRespondSchema } from "@/lib/social/room-schemas";
import { createNotification } from "@/lib/social/notifications";
import { areFriends, isFollowing, isEitherBlocked } from "@/lib/social/friends";
import { generateRoomCode, normalizeRoomCode } from "@/lib/social/rooms";

/**
 * POST — Çevrimdışı davet gönder (oda olmadan anime izleyen birine).
 * Hedef kullanıcının allowOfflineInvites açık olmalı.
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

  const parsed = offlineInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar." }, { status: 400 });
  }

  const { targetUserId, animeId, animeName, episodeId, episodeName, poster } = parsed.data;

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
    select: { id: true, dndEnabled: true, allowOfflineInvites: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (!target.allowOfflineInvites) {
    return NextResponse.json({ success: false, error: "Kullanıcı çevrimdışı davetleri kapalı." }, { status: 403 });
  }
  if (target.dndEnabled) {
    return NextResponse.json({ success: false, error: "Kullanıcı rahatsız etme modunda." }, { status: 409 });
  }

  await createNotification(targetUserId, "offline_invite", {
    requesterId: user!.id,
    username: user!.username,
    displayName: user!.displayName,
    avatarUrl: user!.avatarUrl,
    animeId,
    animeName,
    episodeId,
    episodeName: episodeName ?? null,
    poster: poster ?? null,
  });

  return NextResponse.json({ success: true });
}

/**
 * PATCH — Çevrimdışı daveti kabul/reddet.
 * Kabul: oda oluştur, isteyen kişiyi üye ekle, her ikisine bildirim gönder.
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

  const parsed = offlineInviteRespondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar." }, { status: 400 });
  }

  const { notificationId, action } = parsed.data;

  const notif = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user!.id, type: "offline_invite" },
  });
  if (!notif) {
    return NextResponse.json({ success: false, error: "Bildirim bulunamadı." }, { status: 404 });
  }

  // Okundu yap
  await prisma.notification.update({
    where: { id: notif.id },
    data: { readAt: new Date() },
  });

  if (action === "decline") {
    return NextResponse.json({ success: true, action: "declined" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(notif.payload);
  } catch {
    return NextResponse.json({ success: false, error: "Bildirim verisi bozuk." }, { status: 500 });
  }

  const requesterId = String(payload.requesterId ?? "");
  const animeId = String(payload.animeId ?? "");
  const animeName = String(payload.animeName ?? "");
  const episodeId = String(payload.episodeId ?? "");
  const episodeName = payload.episodeName ? String(payload.episodeName) : null;
  const poster = payload.poster ? String(payload.poster) : null;

  if (!requesterId || !animeId || !episodeId) {
    return NextResponse.json({ success: false, error: "Eksik bildirim verisi." }, { status: 400 });
  }

  // Oda oluştur — kabul eden kişi host olur
  const code = await generateRoomCode();
  const room = await prisma.room.create({
    data: {
      code,
      hostId: user!.id,
      animeId,
      animeName,
      episodeId,
      episodeName,
      poster,
      isPublic: false,
      members: {
        createMany: {
          data: [
            { userId: user!.id, role: "host" },
            { userId: requesterId, role: "guest" },
          ],
        },
      },
    },
    select: { id: true, code: true, animeName: true },
  });

  const inviteUrl = `/oda/${room.id}?code=${encodeURIComponent(normalizeRoomCode(room.code))}`;

  // İstek sahibine bildirim: oda oluştu, katıl
  await createNotification(requesterId, "offline_invite_accepted", {
    roomId: room.id,
    roomCode: room.code,
    inviteUrl,
    animeName: room.animeName,
    username: user!.username,
    displayName: user!.displayName,
    avatarUrl: user!.avatarUrl,
  });

  return NextResponse.json({
    success: true,
    action: "accepted",
    room: { id: room.id, code: room.code, inviteUrl },
  });
}
