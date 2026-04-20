import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { pushToUsers } from "@/lib/realtime/push";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ success: false, error: "Giriş gerekli." }, { status: 401 });
  }
  const room = await prisma.room.findUnique({
    where: { id },
    select: { hostId: true, endedAt: true },
  });
  if (!room) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  // Host'un ayrılması odayı kapatır
  if (room.hostId === session.sub) {
    if (!room.endedAt) {
      const members = await prisma.roomMember.findMany({
        where: { roomId: id, banned: false, leftAt: null },
        select: { userId: true },
      });
      await prisma.room.update({ where: { id }, data: { endedAt: new Date() } });
      await prisma.roomMember.updateMany({
        where: { roomId: id, leftAt: null },
        data: { leftAt: new Date() },
      });
      pushToUsers(members.map((m) => m.userId), { t: "room.closed", roomId: id });
    }
    return NextResponse.json({ success: true, ended: true });
  }
  await prisma.roomMember.updateMany({
    where: { roomId: id, userId: session.sub },
    data: { leftAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
