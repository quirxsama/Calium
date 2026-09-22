import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const release = await prisma.appRelease.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      version: true,
      versionCode: true,
      notes: true,
      fileName: true,
      fileSize: true,
      downloadCount: true,
      createdAt: true,
    },
  });

  if (!release) {
    return NextResponse.json({ success: false, release: null });
  }

  return NextResponse.json({
    success: true,
    release: {
      ...release,
      downloadUrl: "/api/apk/download",
    },
  });
}
