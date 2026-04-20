import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getFollowStatus, getFriendIds, isFollowing, isBlocked } from "@/lib/social/friends";

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
      isPrivate: true,
      createdAt: true,
      _count: {
        select: {
          favorites: true,
          lists: true,
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const session = await getSession();
  const isOwner = session?.sub === user.id;
  const viewerId = session?.sub ?? null;

  // Blok kontrolü — engellenmişse 404 gibi davran
  if (viewerId && !isOwner && (await isBlocked(user.id, viewerId))) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  // Takip durumu (viewer için)
  const followStatus = viewerId
    ? await getFollowStatus(viewerId, user.id)
    : "not_following";

  const friendCount = (await getFriendIds(user.id)).length;

  // Gizli hesap + takipçi değilseniz içerik erişimi yok.
  const canSeeContent =
    isOwner ||
    !user.isPrivate ||
    (viewerId ? await isFollowing(viewerId, user.id) : false);

  const baseUser = {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    profilePublic: user.profilePublic,
    listsPublic: user.listsPublic,
    isPrivate: user.isPrivate,
    createdAt: user.createdAt,
    _count: {
      favorites: user._count.favorites,
      lists: user._count.lists,
      followers: user._count.followers,
      following: user._count.following,
      friends: friendCount,
    },
  };

  if (!canSeeContent || (!user.profilePublic && !isOwner)) {
    return NextResponse.json({
      success: true,
      user: baseUser,
      isOwner,
      followStatus,
      lists: [],
      restricted: true,
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
    user: baseUser,
    isOwner,
    followStatus,
    lists,
    restricted: false,
  });
}
