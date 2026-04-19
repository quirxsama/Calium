import { NextRequest, NextResponse } from "next/server";
import { searchAnime } from "@/lib/anizium/endpoints";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const page = Number(sp.get("page") ?? "1") || 1;
  if (!q.trim()) {
    return NextResponse.json({ success: true, page: { data: [] } });
  }
  try {
    const data = await searchAnime(q, page);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message, page: { data: [] } },
      { status: 502 }
    );
  }
}
