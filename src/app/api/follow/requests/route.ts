import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Bekleyen takip istekleri (bana gelenler).
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const requests = await prisma.followRequest.findMany({
    where: { targetId: user!.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      requester: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    requests: requests.map((r) => ({
      id: `${r.requesterId}:${r.targetId}`,
      createdAt: r.createdAt,
      requester: r.requester,
    })),
  });
}
