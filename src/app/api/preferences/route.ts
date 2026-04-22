import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

const VALID_QUALITIES = new Set(["auto", "2160p", "1440p", "1080p", "720p", "480p"]);
const VALID_DUB_LANGUAGES = new Set(["en", "tr", "ja"]);

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const pref = await prisma.preference.findUnique({ where: { userId: user!.id } });
  return NextResponse.json({ success: true, preferences: pref });
}

export async function PUT(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const defaultQuality = typeof data.defaultQuality === "string" && VALID_QUALITIES.has(data.defaultQuality)
    ? data.defaultQuality
    : undefined;
  const defaultDubLanguage = typeof data.defaultDubLanguage === "string" && VALID_DUB_LANGUAGES.has(data.defaultDubLanguage)
    ? data.defaultDubLanguage
    : undefined;

  const pref = await prisma.preference.upsert({
    where: { userId: user!.id },
    update: {
      theme: typeof data.theme === "string" ? data.theme : undefined,
      captionSettings: typeof data.captionSettings === "string" ? data.captionSettings : undefined,
      autoPlay: typeof data.autoPlay === "boolean" ? data.autoPlay : undefined,
      defaultQuality,
      defaultDubLanguage,
    },
    create: {
      userId: user!.id,
      theme: typeof data.theme === "string" ? data.theme : "dark",
      captionSettings: typeof data.captionSettings === "string" ? data.captionSettings : undefined,
      autoPlay: typeof data.autoPlay === "boolean" ? data.autoPlay : true,
      defaultQuality: defaultQuality ?? "auto",
      defaultDubLanguage: defaultDubLanguage ?? "ja",
    },
  });

  return NextResponse.json({ success: true, preferences: pref });
}
