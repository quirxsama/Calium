import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { updateProfileSchema } from "@/lib/auth/validation";
import { checkImageNsfw } from "@/lib/moderation";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

async function readAvatarInput(value: unknown): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  if (value.startsWith("data:image/")) {
    const match = value.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!match) return undefined;
    const byteLength = Buffer.from(match[1], "base64").byteLength;
    if (byteLength > MAX_AVATAR_SIZE) {
      throw new Error("Avatar boyutu en fazla 5MB olabilir.");
    }
    return value;
  }

  return value;
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Doğrulama hatası." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName || null;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio || null;
  if (parsed.data.avatarUrl !== undefined) {
    let url: string | null | undefined;
    try {
      url = await readAvatarInput(parsed.data.avatarUrl);
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Avatar doğrulanamadı." }, { status: 400 });
    }

    if (url) {
      const moderation = url.startsWith("data:image/") ? { safe: true as const } : await checkImageNsfw(url);
      if (!moderation.safe) {
        return NextResponse.json(
          { success: false, error: moderation.reason ?? "Bu görsel uygunsuz içerik barındırıyor." },
          { status: 400 }
        );
      }
    }
    data.avatarUrl = url;
  }
  if (parsed.data.profilePublic !== undefined) data.profilePublic = parsed.data.profilePublic;
  if (parsed.data.listsPublic !== undefined) data.listsPublic = parsed.data.listsPublic;
  if (parsed.data.historyPublic !== undefined) data.historyPublic = parsed.data.historyPublic;
  if (parsed.data.commentsPublic !== undefined) data.commentsPublic = parsed.data.commentsPublic;
  if (parsed.data.isPrivate !== undefined) data.isPrivate = parsed.data.isPrivate;
  if (parsed.data.dndEnabled !== undefined) data.dndEnabled = parsed.data.dndEnabled;
  if (parsed.data.allowOfflineInvites !== undefined) data.allowOfflineInvites = parsed.data.allowOfflineInvites;

  const updated = await prisma.user.update({
    where: { id: user!.id },
    data,
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
      commentsPublic: true,
      isPrivate: true,
      dndEnabled: true,
      allowOfflineInvites: true,
    },
  });

  return NextResponse.json({ success: true, user: updated });
}
