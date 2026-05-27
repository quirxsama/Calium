import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { registerSchema } from "@/lib/auth/validation";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, { bucket: "auth-register", max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: "Çok fazla istek. Lütfen bekleyin." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Doğrulama hatası." }, { status: 400 });
  }

  const { email, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    const field = existing.email === email ? "Email" : "Kullanıcı adı";
    return NextResponse.json({ success: false, error: `${field} zaten kullanılıyor.` }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, username, passwordHash, displayName: username },
  });

  // Create default preferences
  await prisma.preference.create({
    data: { userId: user.id },
  });

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
