import { NextRequest, NextResponse } from "next/server";
import { getCatalog, type CatalogKind } from "@/lib/anizium/endpoints";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = (sp.get("kind") ?? "series") as CatalogKind;
  const id = sp.get("id") ?? undefined;
  const page = Number(sp.get("page") ?? "1") || 1;
  try {
    const data = await getCatalog({ kind, id, page });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}
