import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { kickSchema } from "@/lib/social/room-schemas";
import { pushToUser } from "@/lib/realtime/push";

/** Host: kullanıcıyı odadan atar (isteğe bağlı olarak banlar). */
export async function POST(
  req: NextRequest,
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
  if (!room || room.endedAt) {
    return NextResponse.json({ success: false, error: "Oda bulunamadı." }, { status: 404 });
  }
  if (room.hostId !== session.sub) {
    return NextResponse.json({ success: false, error: "Sadece host kick atabilir." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz gövde." }, { status: 400 });
  }
  const parsed = kickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Geçersiz alanlar" }, { status: 400 });
  }
  if (parsed.data.userId === session.sub) {
    return NextResponse.json({ success: false, error: "Kendini atamazsın." }, { status: 400 });
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: id, userId: parsed.data.userId } },
    update: { banned: !!parsed.data.ban, leftAt: new Date() },
    create: {
      roomId: id,
      userId: parsed.data.userId,
      role: "guest",
      banned: !!parsed.data.ban,
      leftAt: new Date(),
    },
  });

  pushToUser(parsed.data.userId, {
    t: "room.kicked",
    roomId: id,
    banned: !!parsed.data.ban,
  });

  return NextResponse.json({ success: true });
}
