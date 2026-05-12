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
    console.error("[api/anizium/anime] detail fetch failed", {
      id,
      message: e instanceof Error ? e.message : String(e),
      hasWorkerUrl: Boolean(process.env.ANIZIUM_WORKER_URL),
      hasCfControl: Boolean(process.env.ANIZIUM_CF_CONTROL),
      hasUserSession: Boolean(process.env.ANIZIUM_USER_SESSION),
    });
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
