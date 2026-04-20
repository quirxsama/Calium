import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Engelleme: iki yöndeki takip ilişkisini ve takip isteklerini siler,
 * Block tablosuna kayıt ekler. Block kaldırıldığında kullanıcı tekrar
 * manuel takip edebilir.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { username } = await params;
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (target.id === user!.id) {
    return NextResponse.json({ success: false, error: "Kendinizi engelleyemezsiniz." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user!.id, followingId: target.id },
          { followerId: target.id, followingId: user!.id },
        ],
      },
    }),
    prisma.followRequest.deleteMany({
      where: {
        OR: [
          { requesterId: user!.id, targetId: target.id },
          { requesterId: target.id, targetId: user!.id },
        ],
      },
    }),
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user!.id, blockedId: target.id } },
      update: {},
      create: { blockerId: user!.id, blockedId: target.id },
    }),
  ]);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { username } = await params;
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  await prisma.block.deleteMany({
    where: { blockerId: user!.id, blockedId: target.id },
  });

  return NextResponse.json({ success: true });
}
