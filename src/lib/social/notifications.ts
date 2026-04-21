import { prisma } from "@/lib/db";
import { pushToUser } from "@/lib/realtime/push";

/**
 * Bildirim oluşturmak için tek giriş noktası. Payload JSON'a serialize
 * edilir, client-side decode'u basit tutmak için event-driven değerler
 * (örn. `actorId`, `username`, `avatarUrl`) dahil edilir.
 */
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
  | "offline_invite_accepted";

export type NotificationPayload = Record<string, unknown>;

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
  // Real-time push (DND'li kullanıcıya ses/bildirim client tarafında susturulur).
  pushToUser(userId, {
    t: "notification",
    id: row.id,
    type,
    payload,
    createdAt: row.createdAt.toISOString(),
  });
  return row;
}
