import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const q = (url.searchParams.get("q") ?? "").trim();
  const perPage = 20;

  const where = q
    ? {
        OR: [
          { username: { contains: q } },
          { email: { contains: q } },
          { displayName: { contains: q } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        profilePublic: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    users,
    page,
    totalPages: Math.ceil(total / perPage),
    total,
  });
}

export async function PATCH(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { userId, action } = body as { userId?: string; action?: string };

  if (!userId || !action) {
    return NextResponse.json({ success: false, error: "userId ve action gerekli." }, { status: 400 });
  }

  // Prevent self-demotion
  if (userId === admin!.id && action === "demote") {
    return NextResponse.json({ success: false, error: "Kendi rolünüzü düşüremezsiniz." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  switch (action) {
    case "promote":
      await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
      break;
    case "demote":
      await prisma.user.update({ where: { id: userId }, data: { role: "user" } });
      break;
    default:
      return NextResponse.json({ success: false, error: "Geçersiz action." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
