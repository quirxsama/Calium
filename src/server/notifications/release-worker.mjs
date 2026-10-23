import { processLatestEpisodes } from "./release-service.mjs";
import { sendMulticastPush } from "../../lib/push/fcm-core.mjs";

export function startReleaseWorker(db, port = 3000) {
  let running = false;
  let stopped = false;

  async function notifyUser(userId, type, payload) {
    const row = await db.notification.create({
      data: {
        userId,
        type,
        payload: JSON.stringify(payload),
      },
    });

    globalThis.__calium_ws?.sendToUser?.(userId, {
      t: "notification",
      id: row.id,
      type,
      payload,
      createdAt: row.createdAt.toISOString(),
    });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { dndEnabled: true },
    });
    if (user?.dndEnabled) return;

    const devices = await db.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (devices.length > 0) {
      const tokens = devices.map((d) => d.token);
      const res = await sendMulticastPush(tokens, {
        title: payload.animeTitle || "Yeni Bölüm",
        body: payload.seasonNumber
          ? `Sezon ${payload.seasonNumber} Bölüm ${payload.episodeNumber} yayında!`
          : `Bölüm ${payload.episodeNumber} yayında!`,
        data: {
          type,
          notificationId: row.id,
          animeId: String(payload.animeId),
          seasonNumber: String(payload.seasonNumber ?? 1),
          episodeNumber: String(payload.episodeNumber ?? 1),
        },
        imageUrl: payload.poster || null,
      });

      if (res?.unregisteredTokens?.length > 0) {
        await db.deviceToken.deleteMany({
          where: { token: { in: res.unregisteredTokens } },
        });
      }
    }
  }

  async function checkLatest() {
    if (running || stopped) return;
    running = true;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/anizium/latest`);
      if (!res.ok) return;
      const json = await res.json();
      const items = json?.page?.data;
      if (Array.isArray(items) && items.length > 0) {
        await processLatestEpisodes(db, items, { notifyUser });
      }
    } catch (err) {
      if (process.env.DEBUG) {
        console.error("[release-worker] check error:", err);
      }
    } finally {
      running = false;
    }
  }

  const initialTimeout = setTimeout(checkLatest, 10000);
  initialTimeout.unref();

  const interval = setInterval(checkLatest, 60000);
  interval.unref();

  return () => {
    stopped = true;
    clearTimeout(initialTimeout);
    clearInterval(interval);
  };
}
