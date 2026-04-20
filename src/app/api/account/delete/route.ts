import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithPassword } from "@/lib/auth/require-user";
import { verifyPassword } from "@/lib/auth/password";
import { deleteAccountSchema } from "@/lib/auth/validation";
import { clearSessionCookie } from "@/lib/auth/session";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, { bucket: "account-delete", max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: "Çok fazla istek." }, { status: 429 });
  }

  const { user, error } = await requireUserWithPassword();
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
