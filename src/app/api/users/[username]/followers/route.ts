import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isFollowing, isEitherBlocked } from "@/lib/social/friends";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const session = await getSession();
  const viewerId = session?.sub ?? null;

  let targetId: string;
  let isPrivate = false;

  if (username === "me" || username === "@me") {
    if (!viewerId) {
      return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
    }
    targetId = viewerId;
  } else {
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true, isPrivate: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
    }
    targetId = target.id;
    isPrivate = target.isPrivate;
  }

  const isOwner = viewerId === targetId;

  if (isPrivate && !isOwner) {
    if (!viewerId || !(await isFollowing(viewerId, targetId))) {
      return NextResponse.json({ success: false, error: "Gizli hesap." }, { status: 403 });
    }
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 30;

  const rows = await prisma.follow.findMany({
    where: { followingId: targetId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor
      ? { cursor: { followerId_followingId: { followerId: cursor, followingId: targetId } }, skip: 1 }
      : {}),
    include: {
      follower: { select: { id: true, username: true, displayName: true, avatarUrl: true, isPrivate: true } },
    },
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    nextCursor = rows[take - 1].followerId;
    rows.pop();
  }

  const items = [];
  for (const r of rows) {
    if (viewerId && (await isEitherBlocked(viewerId, r.follower.id))) continue;
    items.push(r.follower);
  }

  return NextResponse.json({ success: true, items, nextCursor });
}
