import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const lists = await prisma.userList.findMany({
    where: { userId: user!.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true, likes: true } },
    },
  });

  return NextResponse.json({ success: true, lists });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const { name, description, isPublic } = body as { name?: string; description?: string; isPublic?: boolean };

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ success: false, error: "Liste adı boş olamaz." }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ success: false, error: "Liste adı çok uzun." }, { status: 400 });
  }

  const list = await prisma.userList.create({
    data: {
      userId: user!.id,
      name: name.trim(),
      description: description?.trim() || null,
      isPublic: isPublic ?? true,
    },
  });

  return NextResponse.json({ success: true, list }, { status: 201 });
}
