import { NextResponse } from "next/server";
import { getSession } from "./session";
import { prisma } from "@/lib/db";

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.sub) {
    return { user: null, error: NextResponse.json({ success: false, error: "Giriş yapmalısınız." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user) {
    return { user: null, error: NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 401 }) };
  }

  if (user.role !== "admin") {
    return { user: null, error: NextResponse.json({ success: false, error: "Yetkiniz yok." }, { status: 403 }) };
  }

  return { user, error: null };
}
