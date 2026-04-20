import { prisma } from "@/lib/db";

/**
 * Sosyal grafik yardımcıları. Arkadaş = iki kullanıcının birbirini takip
 * etmesi (simetrik). Ayrı tablo tutulmaz; her kontrolde türetilir.
 */

export type FollowStatus =
  | "self"
  | "following"    // sen onu takip ediyorsun
  | "requested"    // takip isteği gönderdin, bekliyor
  | "not_following";

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return false;
  const f = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { followerId: true },
  });
  return !!f;
}

export async function hasPendingRequest(requesterId: string, targetId: string): Promise<boolean> {
  if (requesterId === targetId) return false;
  const r = await prisma.followRequest.findUnique({
    where: { requesterId_targetId: { requesterId, targetId } },
    select: { requesterId: true },
  });
  return !!r;
}

export async function areFriends(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return false;
  const [a, b] = await Promise.all([
    isFollowing(userA, userB),
    isFollowing(userB, userA),
  ]);
  return a && b;
}

/**
 * Karşılıklı takipleşilenlerin (arkadaşların) id listesi.
 */
export async function getFriendIds(userId: string): Promise<string[]> {
  // Iki sorgu sonrası JS'te intersect — SQLite'ta subquery JOIN da uygundur
  // ama bu tek user seviyesinde N küçük; basit tutuyoruz.
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }),
  ]);
  const followerSet = new Set(followers.map((f) => f.followerId));
  return following.map((f) => f.followingId).filter((id) => followerSet.has(id));
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const b = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { blockerId: true },
  });
  return !!b;
}

/**
 * A, B'yi engelledi mi YA DA B, A'yı engelledi mi? İki yönde de erişim kapanır.
 */
export async function isEitherBlocked(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const hit = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return !!hit;
}

export async function getFollowStatus(
  viewerId: string,
  targetId: string
): Promise<FollowStatus> {
  if (viewerId === targetId) return "self";
  const [following, pending] = await Promise.all([
    isFollowing(viewerId, targetId),
    hasPendingRequest(viewerId, targetId),
  ]);
  if (following) return "following";
  if (pending) return "requested";
  return "not_following";
}
