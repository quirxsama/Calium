import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRoomAccess } from "@/lib/social/rooms";

/** Bir kullanıcıyı odaya üye olarak kaydeder. WS sadece yetki kontrolü yapar;
 * fiziksel üyelik DB'de buradan oluşur. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }

  const acc = await getRoomAccess(session.sub, id);
  if (acc.access === "not_found") {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  if (acc.access === "ended") {
    return NextResponse.json({ success: false, error: "Oda kapandı." }, { status: 410 });
  }
  if (acc.access === "banned" || acc.access === "forbidden") {
    return NextResponse.json({ success: false, error: "Erişim yok." }, { status: 403 });
  }

  if (acc.access === "invited") {
    // Daveti kabul et
    await prisma.roomInvite.updateMany({
      where: { roomId: id, inviteeId: session.sub, status: "pending" },
      data: { status: "accepted" },
    });
  }

  if (acc.access !== "host" && acc.access !== "member") {
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: id, userId: session.sub } },
      update: { leftAt: null, banned: false, role: "guest" },
      create: { roomId: id, userId: session.sub, role: "guest" },
    });
  }

  await prisma.room.update({ where: { id }, data: { lastActiveAt: new Date() } });

  return NextResponse.json({ success: true });
}
