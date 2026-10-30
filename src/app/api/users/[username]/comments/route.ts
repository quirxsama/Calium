import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isBlocked, isFollowing } from "@/lib/social/friends";
import { listCommentsByUser } from "@/lib/comments/service";
import { resolveCommentLimit } from "@/lib/comments/schemas";

/**
 * Profildeki yorumlar. Erişim kuralları profil sayfasıyla aynı:
 * - Profil gizliyse veya engellenmişse içerik gösterilmez.
 * - Kullanıcı yorum görünürlüğünü kapatıysa (commentsPublic=false) sadece
 *   sahibi görebilir; diğerlerine boş liste + visible:false döner.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, profilePublic: true, isPrivate: true, commentsPublic: true },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  const session = await getSession();
  const viewerId = session?.sub ?? null;
  const isOwner = viewerId === user.id;

  if (viewerId && !isOwner && (await isBlocked(user.id, viewerId))) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (!isOwner) {
    const canSeeContent =
      user.profilePublic && (!user.isPrivate || (viewerId ? await isFollowing(viewerId, user.id) : false));
    if (!canSeeContent || !user.commentsPublic) {
      return NextResponse.json({ success: true, data: { comments: [], nextCursor: null, visible: false } });
    }
  }

  const searchParams = req.nextUrl.searchParams;
  const data = await listCommentsByUser({
    userId: user.id,
    cursor: (searchParams.get("cursor") ?? "").trim() || null,
    limit: resolveCommentLimit(searchParams.get("limit")),
    viewer: session ? { id: session.sub, role: session.role } : null,
  });

  return NextResponse.json({ success: true, data: { ...data, visible: true } });
}
