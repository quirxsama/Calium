import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { softDeleteComment } from "@/lib/comments/service";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await params;
  const result = await softDeleteComment(id, { id: user!.id, role: user!.role });

  if (result === "not_found") {
    return NextResponse.json({ success: false, error: "Yorum bulunamadı." }, { status: 404 });
  }
  if (result === "forbidden") {
    return NextResponse.json({ success: false, error: "Bu yorumu silemezsiniz." }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
