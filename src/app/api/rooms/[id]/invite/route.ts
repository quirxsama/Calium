import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { inviteSchema } from "@/lib/social/room-schemas";
import { getFriendIds, isEitherBlocked } from "@/lib/social/friends";
import { createNotification } from "@/lib/social/notifications";
import { normalizeRoomCode } from "@/lib/social/rooms";

/** Oda üyesi bir başka kullanıcıyı davet eder. Host değilse de davet edebilir
 * (ileride host-only flag eklenebilir; şimdi hem host hem üye). */
export async function POST(
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
    select: {
      id: true,
      code: true,
      hostId: true,
      endedAt: true,
      animeName: true,
      members: { where: { userId: session.sub, banned: false }, select: { userId: true } },
      host: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  const isMember = room.hostId === session.sub || room.members.length > 0;
  if (!isMember) {
    return NextResponse.json({ success: false, error: "Oda üyesi değilsin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz gövde." }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar" }, { status: 400 });
  }

  const inviteUrl = `/oda/${id}?code=${encodeURIComponent(normalizeRoomCode(room.code))}`;

  if (!parsed.data.username && !parsed.data.friendId) {
    return NextResponse.json({
      success: true,
      invite: {
        roomId: id,
        roomCode: room.code,
        inviteUrl,
      },
    });
  }

  const invitee = await prisma.user.findFirst({
    where: parsed.data.friendId
      ? { id: parsed.data.friendId }
      : { username: parsed.data.username },
    select: { id: true, username: true, dndEnabled: true },
  });
  if (!invitee) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (invitee.id === session.sub) {
    return NextResponse.json({ success: false, error: "Kendini davet edemezsin." }, { status: 400 });
  }
  if (await isEitherBlocked(session.sub, invitee.id)) {
    return NextResponse.json({ success: false, error: "Bu kullanıcıyı davet edemezsin." }, { status: 403 });
  }

  if (parsed.data.friendId) {
    const friendIds = await getFriendIds(session.sub);
    if (!friendIds.includes(invitee.id)) {
      return NextResponse.json({ success: false, error: "Sadece arkadaşlarını davet edebilirsin." }, { status: 403 });
    }
  }

  // Upsert: mevcut bekleyen daveti yenile
  const existing = await prisma.roomInvite.findFirst({
    where: { roomId: id, inviteeId: invitee.id, status: "pending" },
  });
  const inviteRow =
    existing ??
    (await prisma.roomInvite.create({
      data: {
        roomId: id,
        inviterId: session.sub,
        inviteeId: invitee.id,
        status: "pending",
      },
    }));

  // DND'li kullanıcıya bildirim yine yazılır; client-side sessizce gösterir.
  await createNotification(invitee.id, "invite", {
    inviteId: inviteRow.id,
    roomId: id,
    roomCode: room.code,
    inviteUrl,
    animeName: room.animeName,
    inviterId: session.sub,
    username: room.host.username,
    displayName: room.host.displayName,
    avatarUrl: room.host.avatarUrl,
  });

  return NextResponse.json({
    success: true,
    invite: {
      roomId: id,
      roomCode: room.code,
      inviteUrl,
      inviteId: inviteRow.id,
      username: invitee.username,
    },
  });
}
