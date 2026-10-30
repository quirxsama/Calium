import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { softDeleteCommentAsAdmin } from "@/lib/comments/service";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  if (!(await softDeleteCommentAsAdmin(id))) {
    return NextResponse.json({ success: false, error: "Yorum bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
