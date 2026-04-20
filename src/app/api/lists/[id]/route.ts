import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const list = await prisma.userList.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, displayName: true, avatarUrl: true } },
      items: { orderBy: { addedAt: "desc" } },
      _count: { select: { likes: true } },
    },
  });

  if (!list) {
    return NextResponse.json({ success: false, error: "Liste bulunamadı." }, { status: 404 });
  }

  const session = await getSession();
  const isOwner = session?.sub === list.userId;

  if (!list.isPublic && !isOwner) {
    return NextResponse.json({ success: false, error: "Bu liste gizli." }, { status: 403 });
  }

  let liked = false;
  if (session?.sub) {
    const existing = await prisma.listLike.findUnique({
      where: { userId_listId: { userId: session.sub, listId: id } },
    });
    liked = !!existing;
  }

  return NextResponse.json({ success: true, list, isOwner, liked });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const list = await prisma.userList.findUnique({ where: { id } });
  if (!list || list.userId !== user!.id) {
    return NextResponse.json({ success: false, error: "Liste bulunamadı." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const { name, description, isPublic } = body as { name?: string; description?: string; isPublic?: boolean };
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description.trim() || null;
  if (isPublic !== undefined) data.isPublic = isPublic;

  const updated = await prisma.userList.update({ where: { id }, data });
  return NextResponse.json({ success: true, list: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const list = await prisma.userList.findUnique({ where: { id } });
  if (!list || list.userId !== user!.id) {
    return NextResponse.json({ success: false, error: "Liste bulunamadı." }, { status: 404 });
  }

  await prisma.userList.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
