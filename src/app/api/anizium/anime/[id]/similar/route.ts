import { NextRequest, NextResponse } from "next/server";
import { getSimilarAnimes } from "@/lib/anizium/endpoints";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const data = await getSimilarAnimes(id);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({
      success: true,
      page: {
        page: 1,
        per_page_items: 0,
        previous_page: null,
        next_page: null,
        total_pages: 0,
        data: [],
      },
      note: (e as Error).message,
    });
  }
}
