import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "node:fs";

let messagingInstance = null;
let initAttempted = false;

export function getFirebaseMessaging() {
  if (initAttempted) return messagingInstance;
  initAttempted = true;

  try {
    if (getApps().length > 0) {
      messagingInstance = getMessaging();
      return messagingInstance;
    }

    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (saEnv) {
      let saJson;
      if (saEnv.trim().startsWith("{")) {
        saJson = JSON.parse(saEnv);
      } else if (fs.existsSync(saEnv)) {
        saJson = JSON.parse(fs.readFileSync(saEnv, "utf-8"));
      } else {
        return null;
      }
      const app = initializeApp({ credential: cert(saJson) });
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }

    if (projectId && clientEmail && privateKey) {
      const app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const app = initializeApp();
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    if (process.env.DEBUG) {
      console.error("[FCM] Failed to initialize Firebase Admin:", err);
    }
  }

  return null;
}

export async function sendMulticastPush(tokens, payload) {
  if (!tokens || tokens.length === 0) {
    return { success: true, sent: 0, failed: 0, unregisteredTokens: [] };
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return { success: false, sent: 0, failed: tokens.length, unregisteredTokens: [] };
  }

  const uniqueTokens = Array.from(new Set(tokens));
  const unregisteredTokens = [];
  let sent = 0;
  let failed = 0;

  const BATCH_SIZE = 500;
  for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
    const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: payload.data || {},
        android: {
          priority: "high",
          notification: {
            channelId: "anime_episodes",
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
          fcmOptions: payload.imageUrl ? { imageUrl: payload.imageUrl } : undefined,
        },
      });

      sent += res.successCount;
      failed += res.failureCount;

      res.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            unregisteredTokens.push(batch[idx]);
          }
        }
      });
    } catch (err) {
      failed += batch.length;
      if (process.env.DEBUG) {
        console.error("[FCM] Batch send error:", err);
      }
    }
  }

  return {
    success: true,
    sent,
    failed,
    unregisteredTokens,
  };
}
