import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { updateProfileSchema } from "@/lib/auth/validation";
import { checkImageNsfw } from "@/lib/moderation";

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
    const url = parsed.data.avatarUrl || null;
    if (url) {
      const moderation = await checkImageNsfw(url);
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
      isPrivate: true,
      dndEnabled: true,
      allowOfflineInvites: true,
    },
  });

  return NextResponse.json({ success: true, user: updated });
}
