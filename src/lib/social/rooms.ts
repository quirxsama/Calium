import { prisma } from "@/lib/db";

/** 6 karakterlik çakışmayan oda kodu üretir. */
export async function generateRoomCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // görsel karışıklık yapanları çıkardık
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const exists = await prisma.room.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Room code üretilemedi");
}

export type RoomSummary = {
  id: string;
  code: string;
  hostId: string;
  animeId: string;
  animeName: string;
  episodeId: string;
  episodeName: string | null;
  poster: string | null;
  isPublic: boolean;
  createdAt: Date;
  lastActiveAt: Date;
};

export type RoomAccess =
  | "not_found"
  | "ended"
  | "banned"
  | "host"
  | "member"
  | "invited"
  | "public"
  | "forbidden";

/** Oda yetkisi: host mu, üye mi, davetli mi, yasak mı? */
export async function getRoomAccess(
  userId: string,
  roomId: string
): Promise<{ access: RoomAccess; isHost: boolean; roomExists: boolean }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      members: { where: { userId }, select: { userId: true, banned: true, role: true } },
      invites: {
        where: { inviteeId: userId, status: "pending" },
        select: { id: true },
      },
    },
  });
  if (!room) return { access: "not_found", isHost: false, roomExists: false };
  if (room.endedAt) return { access: "ended", isHost: false, roomExists: true };
  const isHost = room.hostId === userId;
  const member = room.members[0];
  if (member?.banned) return { access: "banned", isHost: false, roomExists: true };
  if (isHost) return { access: "host", isHost: true, roomExists: true };
  if (member) return { access: "member", isHost: false, roomExists: true };
  if (room.invites[0]) return { access: "invited", isHost: false, roomExists: true };
  if (room.isPublic) return { access: "public", isHost: false, roomExists: true };
  return { access: "forbidden", isHost: false, roomExists: true };
}
