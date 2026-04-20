import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isFollowing, isEitherBlocked } from "@/lib/social/friends";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isPrivate: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const session = await getSession();
  const viewerId = session?.sub ?? null;
  const isOwner = viewerId === target.id;

  if (target.isPrivate && !isOwner) {
    if (!viewerId || !(await isFollowing(viewerId, target.id))) {
      return NextResponse.json({ success: false, error: "Gizli hesap." }, { status: 403 });
    }
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 30;

  const rows = await prisma.follow.findMany({
    where: { followerId: target.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor
      ? { cursor: { followerId_followingId: { followerId: target.id, followingId: cursor } }, skip: 1 }
      : {}),
    include: {
      following: { select: { id: true, username: true, displayName: true, avatarUrl: true, isPrivate: true } },
    },
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    nextCursor = rows[take - 1].followingId;
    rows.pop();
  }

  const items = [];
  for (const r of rows) {
    if (viewerId && (await isEitherBlocked(viewerId, r.following.id))) continue;
    items.push(r.following);
  }

  return NextResponse.json({ success: true, items, nextCursor });
}
