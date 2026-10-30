import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getClientIp, rateLimit } from "@/lib/auth/rate-limit";
import { requireUser } from "@/lib/auth/require-user";
import { createComment, listComments } from "@/lib/comments/service";
import { CreateCommentSchema, resolveCommentLimit } from "@/lib/comments/schemas";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const animeId = (searchParams.get("animeId") ?? "").trim();
  if (!animeId) {
    return NextResponse.json({ success: false, error: "animeId gerekli." }, { status: 400 });
  }

  const session = await getSession();
  const data = await listComments({
    where: {
      animeId,
      episodeId: (searchParams.get("episodeId") ?? "").trim() || null,
      deleted: false,
    },
    cursor: (searchParams.get("cursor") ?? "").trim() || null,
    limit: resolveCommentLimit(searchParams.get("limit")),
    viewer: session ? { id: session.sub, role: session.role } : null,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  if (!rateLimit(getClientIp(req), { bucket: "comments", windowMs: 60_000, max: 5 }).ok) {
    return NextResponse.json(
      { success: false, error: "Çok fazla yorum gönderdiniz. Lütfen biraz bekleyin." },
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const parsed = CreateCommentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri." },
      { status: 400 }
    );
  }

  const comment = await createComment(
    {
      userId: user!.id,
      animeId: parsed.data.animeId,
      episodeId: parsed.data.episodeId ?? null,
      body: parsed.data.body,
    },
    { id: user!.id, role: user!.role }
  );

  return NextResponse.json({ success: true, data: { comment } }, { status: 201 });
}
