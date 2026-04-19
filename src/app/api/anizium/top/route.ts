import { NextRequest, NextResponse } from "next/server";
import { getTop } from "@/lib/anizium/endpoints";

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
  try {
    const data = await getTop(page);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
