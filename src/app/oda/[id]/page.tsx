import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { RoomClient } from "@/components/rooms/room-client";
import { getRoomAccess } from "@/lib/social/rooms";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  const { code } = await searchParams;
  const user = await getCurrentUser();
  const nextUrl = code ? `/oda/${id}?code=${encodeURIComponent(code)}` : `/oda/${id}`;
  if (!user) redirect(`/giris?next=${encodeURIComponent(nextUrl)}`);

  const acc = await getRoomAccess(user.id, id);
  if (acc.access === "not_found") notFound();
  if (acc.access === "banned") redirect("/arkadaslar");

  const room = await prisma.room.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      hostId: true,
      animeId: true,
      animeName: true,
      episodeId: true,
      episodeName: true,
      poster: true,
      isPublic: true,
      endedAt: true,
      hostLeftAt: true,
      host: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!room) notFound();

  const normalizedQueryCode = code?.trim().toUpperCase();
  const urlAllowed = normalizedQueryCode && normalizedQueryCode === room.code;
  const hasPendingInvite = await prisma.roomInvite.findFirst({
    where: { roomId: id, inviteeId: user.id, status: "pending" },
    select: { id: true },
  });
  if (acc.access === "forbidden" && !urlAllowed) {
    redirect("/arkadaslar");
  }
  if (acc.access === "forbidden" && urlAllowed && !hasPendingInvite && !room.isPublic) {
    redirect("/arkadaslar");
  }

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
        hostLeftAt: room.hostLeftAt ? room.hostLeftAt.toISOString() : null,
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
