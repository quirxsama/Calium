import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { animeId, name, poster } = body as { animeId: string; name: string; poster?: string | null };

  if (!animeId || !name) {
    return NextResponse.json({ success: false, error: "animeId ve name zorunlu." }, { status: 400 });
  }

  const item = await prisma.listItem.upsert({
    where: { listId_animeId: { listId: id, animeId } },
    update: { name, poster: poster ?? null },
    create: { listId: id, animeId, name, poster: poster ?? null },
  });

  return NextResponse.json({ success: true, item }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { animeId } = body as { animeId: string };

  await prisma.listItem.deleteMany({ where: { listId: id, animeId } });
  return NextResponse.json({ success: true });
}
