import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { openAsBlob } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const APK_DIR = path.join(process.cwd(), "data", "apk");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const release = id
    ? await prisma.appRelease.findUnique({ where: { id } })
    : await prisma.appRelease.findFirst({ orderBy: { createdAt: "desc" } });

  if (!release) {
    return new NextResponse("APK bulunamadı.", { status: 404 });
  }

  const safeFileName = path.basename(release.fileName);
  const fullPath = path.join(APK_DIR, safeFileName);

  try {
    const fileStat = await fs.stat(fullPath);
    const blob = await openAsBlob(fullPath);

    // İndirme sayacını arka planda artır
    prisma.appRelease
      .update({
        where: { id: release.id },
        data: { downloadCount: { increment: 1 } },
      })
      .catch((err) => {
        console.error("[apk/download] counter increment error:", err);
      });

    return new Response(blob.stream(), {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Content-Length": fileStat.size.toString(),
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[apk/download] error reading file:", err);
    return new NextResponse("Dosya sunucuda bulunamadı.", { status: 404 });
  }
}
