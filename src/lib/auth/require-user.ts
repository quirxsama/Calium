import { NextResponse } from "next/server";
import { getSession } from "./session";
import { prisma } from "@/lib/db";

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  role: true,
  profilePublic: true,
  listsPublic: true,
  historyPublic: true,
  isPrivate: true,
  dndEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Default: passwordHash içermeyen güvenli alan seti döner.
 * Şifre doğrulaması gereken endpoint'ler `requireUserWithPassword()` kullanmalı.
 */
export async function requireUser() {
  const session = await getSession();
  if (!session?.sub) {
    return { user: null, error: NextResponse.json({ success: false, error: "Giriş yapmalısınız." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: SAFE_USER_SELECT,
  });
  if (!user) {
    return { user: null, error: NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 401 }) };
  }

  return { user, error: null };
}

export async function requireUserWithPassword() {
  const session = await getSession();
  if (!session?.sub) {
    return { user: null, error: NextResponse.json({ success: false, error: "Giriş yapmalısınız." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { ...SAFE_USER_SELECT, passwordHash: true },
  });
  if (!user) {
    return { user: null, error: NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 401 }) };
  }

  return { user, error: null };
}
