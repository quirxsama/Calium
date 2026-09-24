import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    const installationId =
      typeof body?.installationId === "string"
        ? body.installationId.trim()
        : null;
    const platform =
      typeof body?.platform === "string" && ["android", "ios", "web"].includes(body.platform)
        ? body.platform
        : "android";

    if (!token || !installationId) {
      return NextResponse.json(
        { success: false, error: "token ve installationId zorunludur." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.deviceToken.deleteMany({
        where: {
          token,
          installationId: { not: installationId },
        },
      });

      await tx.deviceToken.upsert({
        where: { installationId },
        create: {
          userId: user!.id,
          installationId,
          token,
          platform,
        },
        update: {
          userId: user!.id,
          token,
          platform,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const installationId =
      typeof body?.installationId === "string"
        ? body.installationId.trim()
        : null;
    const token = typeof body?.token === "string" ? body.token.trim() : null;

    if (!installationId && !token) {
      return NextResponse.json(
        { success: false, error: "installationId veya token belirtilmelidir." },
        { status: 400 }
      );
    }

    await prisma.deviceToken.deleteMany({
      where: {
        userId: user!.id,
        ...(installationId ? { installationId } : {}),
        ...(token ? { token } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
