import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { isEitherBlocked } from "@/lib/social/friends";
import { createNotification } from "@/lib/social/notifications";

/**
 * POST → takip et (hesap açıksa anında Follow, kapalıysa FollowRequest).
 * DELETE → takipten çık veya bekleyen isteği iptal et.
 */

async function loadTarget(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, isPrivate: true, avatarUrl: true, displayName: true },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, { bucket: "follow", max: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: "Çok fazla istek." }, { status: 429 });
  }

  const { user, error } = await requireUser();
  if (error) return error;

  const { username } = await params;
  const target = await loadTarget(username);
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (target.id === user!.id) {
    return NextResponse.json({ success: false, error: "Kendinizi takip edemezsiniz." }, { status: 400 });
  }
  if (await isEitherBlocked(user!.id, target.id)) {
    return NextResponse.json({ success: false, error: "Bu kullanıcıyı takip edemezsiniz." }, { status: 403 });
  }

  // Zaten takip ediyorsan no-op success
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user!.id, followingId: target.id } },
    select: { followerId: true },
  });
  if (existing) {
    return NextResponse.json({ success: true, status: "following" });
  }

  if (target.isPrivate) {
    // Takip isteği aç / yeniden aç
    await prisma.followRequest.upsert({
      where: { requesterId_targetId: { requesterId: user!.id, targetId: target.id } },
      update: {},
      create: { requesterId: user!.id, targetId: target.id },
    });
    await createNotification(target.id, "follow_request", {
      actorId: user!.id,
      username: user!.username,
      displayName: user!.displayName,
      avatarUrl: user!.avatarUrl,
    });
    return NextResponse.json({ success: true, status: "requested" });
  }

  await prisma.follow.create({
    data: { followerId: user!.id, followingId: target.id },
  });
  await createNotification(target.id, "follow", {
    actorId: user!.id,
    username: user!.username,
    displayName: user!.displayName,
    avatarUrl: user!.avatarUrl,
  });
  return NextResponse.json({ success: true, status: "following" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { username } = await params;
  const target = await loadTarget(username);
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  await Promise.all([
    prisma.follow.deleteMany({ where: { followerId: user!.id, followingId: target.id } }),
    prisma.followRequest.deleteMany({ where: { requesterId: user!.id, targetId: target.id } }),
  ]);

  return NextResponse.json({ success: true, status: "not_following" });
}
