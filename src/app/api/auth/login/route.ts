import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, { bucket: "auth-login", max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Doğrulama hatası." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Kullanıcı bulunamadığında da sabit-süre doğrulama çalıştırarak
  // email-enumeration timing attack'ini engelle.
  const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8n3zb0cTiL4m6DwfwKh2Yi8h9gF0A2";
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hashToCheck);
  if (!user || !valid) {
    return NextResponse.json({ success: false, error: "Email veya şifre hatalı." }, { status: 401 });
  }

  await prisma.loginIp.create({ data: { userId: user.id, ip } });

  const token = await signToken(user.id, user.role);
  const cookie = setSessionCookie(token);

  const res = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      profilePublic: user.profilePublic,
      listsPublic: user.listsPublic,
      historyPublic: user.historyPublic,
    },
  });

  res.cookies.set(cookie);
  return res;
}
