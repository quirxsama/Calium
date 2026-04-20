import { NextResponse } from "next/server";
import { getSession } from "./session";
import { prisma } from "@/lib/db";

export async function requireUser() {
  const session = await getSession();
  if (!session?.sub) {
    return { user: null, error: NextResponse.json({ success: false, error: "Giriş yapmalısınız." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return { user: null, error: NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 401 }) };
  }

  return { user, error: null };
}
