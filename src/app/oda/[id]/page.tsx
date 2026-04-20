import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { RoomClient } from "@/components/rooms/room-client";
import { getRoomAccess } from "@/lib/social/rooms";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/oda/${id}`)}`);

  const acc = await getRoomAccess(user.id, id);
  if (acc.access === "not_found") notFound();

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      host: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!room) notFound();

  return (
    <RoomClient
      initialRoom={{
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        animeId: room.animeId,
        animeName: room.animeName,
        episodeId: room.episodeId,
        episodeName: room.episodeName,
        poster: room.poster,
        isPublic: room.isPublic,
        endedAt: room.endedAt ? room.endedAt.toISOString() : null,
        host: room.host,
      }}
      initialAccess={acc.access}
      isHost={acc.isHost}
      currentUser={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
