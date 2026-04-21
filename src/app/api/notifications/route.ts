import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

/**
 * GET  → bildirimlerini ve okunmamış sayını döner.
 * PATCH → tümünü ya da belirli id'leri "okundu" işaretler.
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const onlyUnread = req.nextUrl.searchParams.get("unread") === "1";

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user!.id, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: user!.id, readAt: null },
    }),
  ]);

  return NextResponse.json({
    success: true,
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      payload: (() => {
        try {
          return JSON.parse(n.payload);
        } catch {
          return {};
        }
      })(),
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: { ids?: string[]; all?: boolean } = {};
  try {
    body = (await req.json()) as { ids?: string[]; all?: boolean };
  } catch {
    body = {};
  }

  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: user!.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: user!.id, id: { in: body.ids.slice(0, 100) } },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const { user, error } = await requireUser();
  if (error) return error;

  await prisma.notification.deleteMany({
    where: { userId: user!.id },
  });

  return NextResponse.json({ success: true });
}
