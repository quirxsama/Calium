import { prisma } from "@/lib/db";
import { pushToUser } from "@/lib/realtime/push";
import { sendPushToUser } from "@/lib/push/fcm";

export type NotificationType =
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "invite"
  | "room_join"
  | "room_request"
  | "room_join_request"
  | "room_join_accepted"
  | "offline_invite"
  | "offline_invite_accepted"
  | "new_episode";

export type NotificationPayload = Record<string, unknown>;

function getPushContent(
  type: NotificationType,
  payload: NotificationPayload
): { title: string; body: string; imageUrl?: string } {
  switch (type) {
    case "new_episode":
      return {
        title: (payload.animeTitle as string) || "Yeni Bölüm",
        body: payload.seasonNumber
          ? `Sezon ${payload.seasonNumber} Bölüm ${payload.episodeNumber} yayında!`
          : `Bölüm ${payload.episodeNumber} yayında!`,
        imageUrl:
          (payload.poster as string) ||
          (payload.imageUrl as string) ||
          undefined,
      };
    case "follow":
      return {
        title: "Yeni Takipçi",
        body: `${payload.displayName || payload.username || "Biri"} seni takip etmeye başladı`,
      };
    case "follow_request":
      return {
        title: "Takip İsteği",
        body: `${payload.displayName || payload.username || "Biri"} seni takip etmek istiyor`,
      };
    case "follow_accepted":
      return {
        title: "Takip İsteği Kabul Edildi",
        body: `${payload.displayName || payload.username || "Kullanıcı"} takip isteğini kabul etti`,
      };
    case "invite":
    case "offline_invite":
      return {
        title: "Birlikte İzleme Daveti",
        body: `${payload.displayName || payload.username || "Bir arkadaşın"} seni izlemeye davet etti`,
      };
    default:
      return {
        title: "Calium",
        body: "Yeni bir bildiriminiz var",
      };
  }
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload
) {
  const row = await prisma.notification.create({
    data: {
      userId,
      type,
      payload: JSON.stringify(payload),
    },
  });

  pushToUser(userId, {
    t: "notification",
    id: row.id,
    type,
    payload,
    createdAt: row.createdAt.toISOString(),
  });

  const pushContent = getPushContent(type, payload);
  const data: Record<string, string> = {
    type,
    notificationId: row.id,
  };
  for (const [k, v] of Object.entries(payload)) {
    if (v != null && typeof v !== "object") {
      data[k] = String(v);
    }
  }

  sendPushToUser(userId, {
    title: pushContent.title,
    body: pushContent.body,
    data,
    imageUrl: pushContent.imageUrl,
  }).catch(() => {});

  return row;
}
