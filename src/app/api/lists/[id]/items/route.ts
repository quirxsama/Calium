import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

const AddItemSchema = z.object({
  animeId: z.string().min(1).max(64),
  name: z.string().min(1).max(300),
  poster: z.string().max(1000).nullable().optional(),
});

const DeleteItemSchema = z.object({
  animeId: z.string().min(1).max(64),
});

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

  const parsed = AddItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri." },
      { status: 400 }
    );
  }
  const { animeId, name, poster } = parsed.data;

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

  const parsed = DeleteItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri." },
      { status: 400 }
    );
  }
  const { animeId } = parsed.data;

  await prisma.listItem.deleteMany({ where: { listId: id, animeId } });
  return NextResponse.json({ success: true });
}
