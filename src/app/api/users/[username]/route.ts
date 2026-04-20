import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      profilePublic: true,
      listsPublic: true,
      createdAt: true,
      _count: { select: { favorites: true, lists: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const session = await getSession();
  const isOwner = session?.sub === user.id;

  if (!user.profilePublic && !isOwner) {
    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        profilePublic: false,
      },
      isOwner: false,
      lists: [],
    });
  }

  let lists: unknown[] = [];
  if (user.listsPublic || isOwner) {
    lists = await prisma.userList.findMany({
      where: {
        userId: user.id,
        ...(isOwner ? {} : { isPublic: true }),
      },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true, likes: true } } },
    });
  }

  return NextResponse.json({
    success: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      profilePublic: user.profilePublic,
      listsPublic: user.listsPublic,
      createdAt: user.createdAt,
      _count: user._count,
    },
    isOwner,
    lists,
  });
}
