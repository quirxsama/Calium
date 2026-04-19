import { NextRequest, NextResponse } from "next/server";
import { getAnimeDetails } from "@/lib/anizium/endpoints";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const data = await getAnimeDetails(id);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
