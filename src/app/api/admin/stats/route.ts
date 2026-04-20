import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, todayUsers, weekUsers, totalFavorites, totalHistory, recentUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.favorite.count(),
      prisma.historyItem.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          avatarUrl: true,
        },
      }),
    ]);

  return NextResponse.json({
    success: true,
    stats: {
      totalUsers,
      todayUsers,
      weekUsers,
      totalFavorites,
      totalHistory,
    },
    recentUsers,
  });
}
