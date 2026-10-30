import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listCommentsForAdmin } from "@/lib/comments/service";
import { resolveCommentLimit } from "@/lib/comments/schemas";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const searchParams = req.nextUrl.searchParams;
  const data = await listCommentsForAdmin({
    q: (searchParams.get("q") ?? "").trim() || null,
    cursor: (searchParams.get("cursor") ?? "").trim() || null,
    limit: resolveCommentLimit(searchParams.get("limit")),
    admin: { id: user!.id, role: user!.role },
  });

  return NextResponse.json({ success: true, data });
}
