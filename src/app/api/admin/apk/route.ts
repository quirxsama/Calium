import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const APK_DIR = path.join(process.cwd(), "data", "apk");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const releases = await prisma.appRelease.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    success: true,
    releases,
    latest: releases[0] ?? null,
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const version = formData.get("version")?.toString().trim();
    const versionCodeRaw = formData.get("versionCode")?.toString().trim();
    const notes = formData.get("notes")?.toString().trim() || null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "APK dosyası gereklidir." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".apk")) {
      return NextResponse.json({ success: false, error: "Yalnızca .apk uzantılı dosyalar yüklenebilir." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "Dosya boyutu en fazla 500MB olabilir." }, { status: 400 });
    }

    if (!version) {
      return NextResponse.json({ success: false, error: "Sürüm bilgisi gereklidir." }, { status: 400 });
    }

    const versionCode = versionCodeRaw ? parseInt(versionCodeRaw, 10) : 1;
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `calium-${sanitizedVersion}-${Date.now()}.apk`;

    await fs.mkdir(APK_DIR, { recursive: true });
    const targetPath = path.join(APK_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, buffer);

    const release = await prisma.appRelease.create({
      data: {
        version,
        versionCode: Number.isFinite(versionCode) && versionCode > 0 ? versionCode : 1,
        notes,
        fileName,
        filePath: path.relative(process.cwd(), targetPath),
        fileSize: file.size,
      },
    });

    return NextResponse.json({ success: true, release });
  } catch (err) {
    console.error("[admin/apk] upload error:", err);
    return NextResponse.json({ success: false, error: "Dosya yüklenirken bir hata oluştu." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "ID gereklidir." }, { status: 400 });
    }

    const release = await prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      return NextResponse.json({ success: false, error: "Sürüm bulunamadı." }, { status: 404 });
    }

    const safeFileName = path.basename(release.fileName);
    const fullPath = path.join(APK_DIR, safeFileName);

    await fs.unlink(fullPath).catch(() => {});
    await prisma.appRelease.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/apk] delete error:", err);
    return NextResponse.json({ success: false, error: "Sürüm silinirken bir hata oluştu." }, { status: 500 });
  }
}
