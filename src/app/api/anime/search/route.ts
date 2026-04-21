import { NextResponse } from "next/server";
import { searchAnime } from "@/lib/anizium/endpoints";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ success: true, results: [] });
  }

  try {
    const res = await searchAnime(q, 1);
    const results = res.page.data.slice(0, 8).map((a) => ({
      id: a.ID,
      name: a.name,
      poster: a.poster ?? null,
    }));
    return NextResponse.json({ success: true, results });
  } catch (e) {
    const msg = (e as Error)?.message ?? "Bilinmeyen hata";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
