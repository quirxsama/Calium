import { cookies, headers } from "next/headers";
import { verifyToken, type TokenPayload } from "./jwt";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "calium_session";

export async function getSession(): Promise<TokenPayload | null> {
  // 1. Check cookies
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) return verifyToken(token);
  } catch (_) {}

  // 2. Check Authorization header (Bearer token)
  try {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) return verifyToken(token);
    }
  } catch (_) {}

  return null;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.sub) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
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
      allowOfflineInvites: true,
      createdAt: true,
    },
  });
  return user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function setSessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
