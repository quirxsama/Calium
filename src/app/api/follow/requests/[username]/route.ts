import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { createNotification } from "@/lib/social/notifications";

/**
 * Takip isteği kabul/reddet. `[username]` requester'ın kullanıcı adıdır.
 *
 * PATCH body: { action: "accept" | "decline" }
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { username } = await params;

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ success: false, error: "Geçersiz eylem." }, { status: 400 });
  }

  const requester = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!requester) {
    return NextResponse.json({ success: false, error: "İstek sahibi bulunamadı." }, { status: 404 });
  }

  const reqRow = await prisma.followRequest.findUnique({
    where: { requesterId_targetId: { requesterId: requester.id, targetId: user!.id } },
    select: { requesterId: true },
  });
  if (!reqRow) {
    return NextResponse.json({ success: false, error: "İstek bulunamadı." }, { status: 404 });
  }

  if (body.action === "accept") {
    await prisma.$transaction([
      prisma.follow.upsert({
        where: { followerId_followingId: { followerId: requester.id, followingId: user!.id } },
        update: {},
        create: { followerId: requester.id, followingId: user!.id },
      }),
      prisma.followRequest.delete({
        where: { requesterId_targetId: { requesterId: requester.id, targetId: user!.id } },
      }),
    ]);
    await createNotification(requester.id, "follow_accepted", {
      actorId: user!.id,
      username: user!.username,
      displayName: user!.displayName,
      avatarUrl: user!.avatarUrl,
    });
    return NextResponse.json({ success: true, status: "accepted" });
  }

  // decline
  await prisma.followRequest.delete({
    where: { requesterId_targetId: { requesterId: requester.id, targetId: user!.id } },
  });
  return NextResponse.json({ success: true, status: "declined" });
}
