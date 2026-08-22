import { NextResponse } from "next/server";
import { getCalendar } from "@/lib/anizium/endpoints";

export async function GET() {
  try {
    const data = await getCalendar();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
