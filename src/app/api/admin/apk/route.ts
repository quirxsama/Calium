import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const APK_DIR = path.join(process.cwd(), "data", "apk");
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500 MB

// 1 saatten eski yarım kalmış .tmp dosyalarını temizle
async function cleanupOldTempFiles() {
  try {
    const files = await fs.readdir(APK_DIR);
    const now = Date.now();
    for (const f of files) {
      if (f.startsWith("upload_") && f.endsWith(".tmp")) {
        const p = path.join(APK_DIR, f);
        const s = await fs.stat(p).catch(() => null);
        if (s && now - s.mtimeMs > 3600 * 1000) {
          await fs.unlink(p).catch(() => {});
        }
      }
    }
  } catch {
    // Klasör henüz yoksa sorun yok
  }
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  cleanupOldTempFiles().catch(() => {});

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
    const contentType = req.headers.get("content-type") || "";

    // 1. Durum: Harici URL (JSON ile gönderim)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const externalUrl = body.externalUrl?.toString().trim();
      const version = body.version?.toString().trim();
      const versionCodeRaw = body.versionCode;
      const notes = body.notes?.toString().trim() || null;

      if (!externalUrl || (!externalUrl.startsWith("http://") && !externalUrl.startsWith("https://"))) {
        return NextResponse.json({ success: false, error: "Geçerli bir URL giriniz (http:// veya https://)." }, { status: 400 });
      }

      if (!version) {
        return NextResponse.json({ success: false, error: "Sürüm bilgisi gereklidir." }, { status: 400 });
      }

      const versionCode = versionCodeRaw ? parseInt(String(versionCodeRaw), 10) : 1;
      const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `calium-${sanitizedVersion}.apk`;

      const release = await prisma.appRelease.create({
        data: {
          version,
          versionCode: Number.isFinite(versionCode) && versionCode > 0 ? versionCode : 1,
          notes,
          fileName,
          filePath: externalUrl,
          fileSize: 0,
        },
      });

      return NextResponse.json({ success: true, release });
    }

    // 2. Durum: FormData (Parçalı Yükleme / Chunked veya Tek Parça)
    const formData = await req.formData();
    const uploadId = formData.get("uploadId")?.toString().trim();
    const chunkIndexRaw = formData.get("chunkIndex");
    const totalChunksRaw = formData.get("totalChunks");
    const chunk = (formData.get("chunk") || formData.get("file")) as File | null;
    const version = formData.get("version")?.toString().trim();
    const versionCodeRaw = formData.get("versionCode")?.toString().trim();
    const notes = formData.get("notes")?.toString().trim() || null;
    const externalUrl = formData.get("externalUrl")?.toString().trim();

    if (externalUrl && (externalUrl.startsWith("http://") || externalUrl.startsWith("https://"))) {
      if (!version) {
        return NextResponse.json({ success: false, error: "Sürüm bilgisi gereklidir." }, { status: 400 });
      }
      const versionCode = versionCodeRaw ? parseInt(versionCodeRaw, 10) : 1;
      const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
      const release = await prisma.appRelease.create({
        data: {
          version,
          versionCode: Number.isFinite(versionCode) && versionCode > 0 ? versionCode : 1,
          notes,
          fileName: `calium-${sanitizedVersion}.apk`,
          filePath: externalUrl,
          fileSize: 0,
        },
      });
      return NextResponse.json({ success: true, release });
    }

    if (!chunk || typeof chunk === "string") {
      return NextResponse.json({ success: false, error: "APK dosyası gereklidir." }, { status: 400 });
    }

    await fs.mkdir(APK_DIR, { recursive: true });

    // Parçalı yükleme mi?
    if (uploadId && chunkIndexRaw !== null && totalChunksRaw !== null) {
      const chunkIndex = parseInt(chunkIndexRaw.toString(), 10);
      const totalChunks = parseInt(totalChunksRaw.toString(), 10);
      const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
      const tempPath = path.join(APK_DIR, `upload_${safeUploadId}.tmp`);

      const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

      if (chunkIndex === 0) {
        // İlk parça ise temp dosyayı sıfırdan oluştur
        await fs.writeFile(tempPath, chunkBuffer);
      } else {
        // Sonraki parçaları sona ekle
        await fs.appendFile(tempPath, chunkBuffer);
      }

      // Tüm parçalar tamamlandı mı?
      if (chunkIndex === totalChunks - 1) {
        if (!version) {
          await fs.unlink(tempPath).catch(() => {});
          return NextResponse.json({ success: false, error: "Sürüm bilgisi gereklidir." }, { status: 400 });
        }

        const stat = await fs.stat(tempPath);
        if (stat.size > MAX_TOTAL_SIZE) {
          await fs.unlink(tempPath).catch(() => {});
          return NextResponse.json({ success: false, error: "Dosya boyutu 500MB sınırını aşıyor." }, { status: 400 });
        }

        const versionCode = versionCodeRaw ? parseInt(versionCodeRaw, 10) : 1;
        const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
        const finalFileName = `calium-${sanitizedVersion}-${Date.now()}.apk`;
        const finalPath = path.join(APK_DIR, finalFileName);

        await fs.rename(tempPath, finalPath);

        const release = await prisma.appRelease.create({
          data: {
            version,
            versionCode: Number.isFinite(versionCode) && versionCode > 0 ? versionCode : 1,
            notes,
            fileName: finalFileName,
            filePath: path.relative(process.cwd(), finalPath),
            fileSize: stat.size,
          },
        });

        return NextResponse.json({ success: true, completed: true, release });
      }

      // Parça başarıyla alındı, sonraki parça bekleniyor
      return NextResponse.json({
        success: true,
        completed: false,
        chunkIndex,
        totalChunks,
      });
    }

    // Standart tek parça yükleme fallback
    if (!chunk.name.toLowerCase().endsWith(".apk")) {
      return NextResponse.json({ success: false, error: "Yalnızca .apk uzantılı dosyalar yüklenebilir." }, { status: 400 });
    }

    if (chunk.size > MAX_TOTAL_SIZE) {
      return NextResponse.json({ success: false, error: "Dosya boyutu 500MB sınırını aşıyor." }, { status: 400 });
    }

    if (!version) {
      return NextResponse.json({ success: false, error: "Sürüm bilgisi gereklidir." }, { status: 400 });
    }

    const versionCode = versionCodeRaw ? parseInt(versionCodeRaw, 10) : 1;
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `calium-${sanitizedVersion}-${Date.now()}.apk`;
    const targetPath = path.join(APK_DIR, fileName);

    const buffer = Buffer.from(await chunk.arrayBuffer());
    await fs.writeFile(targetPath, buffer);

    const release = await prisma.appRelease.create({
      data: {
        version,
        versionCode: Number.isFinite(versionCode) && versionCode > 0 ? versionCode : 1,
        notes,
        fileName,
        filePath: path.relative(process.cwd(), targetPath),
        fileSize: chunk.size,
      },
    });

    return NextResponse.json({ success: true, completed: true, release });
  } catch (err) {
    console.error("[admin/apk] upload error:", err);
    return NextResponse.json({ success: false, error: "Dosya işlenirken bir hata oluştu." }, { status: 500 });
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

    if (!release.filePath.startsWith("http://") && !release.filePath.startsWith("https://")) {
      const safeFileName = path.basename(release.fileName);
      const fullPath = path.join(APK_DIR, safeFileName);
      await fs.unlink(fullPath).catch(() => {});
    }

    await prisma.appRelease.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/apk] delete error:", err);
    return NextResponse.json({ success: false, error: "Sürüm silinirken bir hata oluştu." }, { status: 500 });
  }
}
