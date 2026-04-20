import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const list = await prisma.userList.findUnique({ where: { id } });
  if (!list) {
    return NextResponse.json({ success: false, error: "Liste bulunamadı." }, { status: 404 });
  }

  await prisma.listLike.upsert({
    where: { userId_listId: { userId: user!.id, listId: id } },
    update: {},
    create: { userId: user!.id, listId: id },
  });

  return NextResponse.json({ success: true, liked: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  await prisma.listLike.deleteMany({ where: { userId: user!.id, listId: id } });
  return NextResponse.json({ success: true, liked: false });
}
