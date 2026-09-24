import { prisma } from "@/lib/db";
import {
  getFirebaseMessaging,
  sendMulticastPush as sendMulticastCore,
} from "./fcm-core.mjs";

export { getFirebaseMessaging };

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string | null;
}

export async function sendMulticastPush(
  tokens: string[],
  payload: PushPayload
) {
  return sendMulticastCore(tokens, payload);
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dndEnabled: true },
  });
  if (!user || user.dndEnabled) return;

  const devices = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });
  if (devices.length === 0) return;

  const tokens = devices.map((d) => d.token);
  const result = await sendMulticastPush(tokens, payload);

  if (result.unregisteredTokens && result.unregisteredTokens.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: result.unregisteredTokens } },
    });
  }
}
