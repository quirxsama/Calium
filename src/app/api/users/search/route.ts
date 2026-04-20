import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isEitherBlocked, getFollowStatus } from "@/lib/social/friends";

/**
 * Kullanıcı adı / görünen isim araması. Giriş zorunlu.
 * Engellenmiş kullanıcılar filtrelenir; kendini döndürmez.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }
  const viewerId = session.sub;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ success: true, items: [] });
  }
  if (q.length > 50) {
    return NextResponse.json({ success: false, error: "Arama terimi çok uzun." }, { status: 400 });
  }

  const rows = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: viewerId } },
        {
          OR: [
            { username: { contains: q } },
            { displayName: { contains: q } },
          ],
        },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isPrivate: true,
    },
    take: 20,
    orderBy: { username: "asc" },
  });

  const items = [];
  for (const u of rows) {
    if (await isEitherBlocked(viewerId, u.id)) continue;
    const followStatus = await getFollowStatus(viewerId, u.id);
    items.push({ ...u, followStatus });
  }

  return NextResponse.json({ success: true, items });
}
