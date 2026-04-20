import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { verifyPassword } from "@/lib/auth/password";
import { deleteAccountSchema } from "@/lib/auth/validation";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Doğrulama hatası." }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.password, user!.passwordHash);
  if (!valid) {
    return NextResponse.json({ success: false, error: "Şifre hatalı." }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: user!.id } });

  const res = NextResponse.json({ success: true });
  res.cookies.set(clearSessionCookie());
  return res;
}
