import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getFriendIds, isFollowing } from "@/lib/social/friends";

/**
 * Arkadaş listesi — karşılıklı takipleşilenler.
 */
export async function GET(
  _req: NextRequest,
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

  const friendIds = await getFriendIds(target.id);
  const items = await prisma.user.findMany({
    where: { id: { in: friendIds } },
    select: { id: true, username: true, displayName: true, avatarUrl: true, isPrivate: true },
    orderBy: { username: "asc" },
  });

  return NextResponse.json({ success: true, items });
}
