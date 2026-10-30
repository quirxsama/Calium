import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/require-user";
import { getRatingSummary, rateAnime } from "@/lib/comments/service";
import { RateAnimeSchema } from "@/lib/comments/schemas";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ animeId: string }> }) {
  const { animeId } = await params;
  const id = animeId.trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "animeId gerekli." }, { status: 400 });
  }

  const session = await getSession();
  return NextResponse.json({ success: true, data: await getRatingSummary(id, session?.sub ?? null) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ animeId: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { animeId } = await params;
  const id = animeId.trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "animeId gerekli." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = RateAnimeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, data: await rateAnime(user!.id, id, parsed.data.value) });
}
