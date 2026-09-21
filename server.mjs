// Custom Next.js server + WebSocket. PM2 bunu `node server.mjs` ile çalıştırır.
// PORT env: HTTP port (Next.js). WS aynı port üzerinde /ws path'inde.

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
import { startWorker } from "./src/server/integrations/worker.mjs";

import { authenticateRequest } from "./src/server/ws/auth.mjs";
import {
  clearPresence,
  registerSocket,
  setPresence,
  sendToUser,
  sendToUsers,
  unregisterSocket,
  getSocketMeta,
} from "./src/server/ws/hub.mjs";
import { handleMessage, sendHello } from "./src/server/ws/handlers.mjs";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

// ---------- Yardımcı: takipçilere bildirim yay ----------
async function getFollowerIdsOf(userId) {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId },
    select: { followerId: true },
  });
  return rows.map((r) => r.followerId);
}

// ---------- Room yetkilendirmesi ----------
async function authorizeRoomJoin(userId, roomId) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        hostId: true,
        isPublic: true,
        endedAt: true,
        members: { select: { userId: true, banned: true, leftAt: true } },
      },
    });
    if (!room || room.endedAt) return { ok: false, reason: "Oda bulunamadı" };
    const isHost = room.hostId === userId;
    if (isHost) return { ok: true, isHost: true };
    const member = room.members.find((m) => m.userId === userId);
    if (member?.banned) {
      const invite = await prisma.roomInvite.findFirst({
        where: { roomId, inviteeId: userId, status: "pending" },
      });
      if (!invite) return { ok: false, reason: "Odadan çıkarıldın" };
      return { ok: true, isHost: false };
    }
    if (member && !member.leftAt) return { ok: true, isHost: false };
    if (room.isPublic) return { ok: true, isHost: false };
    // Private (default): davet veya üyelik gerekli
    if (!member || member.leftAt) {
      // Açık davetiyesi var mı?
      const invite = await prisma.roomInvite.findFirst({
        where: { roomId, inviteeId: userId, status: "pending" },
      });
      if (!invite) return { ok: false, reason: "Davet gerekli" };
    }
    return { ok: true, isHost: false };
  } catch (e) {
    console.error("[ws] authorizeRoomJoin error:", e);
    return { ok: false, reason: "server_error" };
  }
}

async function authorizeRoomPlayback(userId, roomId) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { hostId: true },
    });
    return !!room && room.hostId === userId;
  } catch {
    return false;
  }
}

// ---------- Presence broadcasting ----------
// Presence değişiminde: kullanıcının takipçilerine VE aynı odalardaki üyelere event gönder
async function broadcastPresence(userId, state) {
  try {
    const followers = await getFollowerIdsOf(userId);
    const payload = {
      t: "presence.event",
      userId,
      status: state.status,
      activity: state.activity ?? null,
    };
    sendToUsers(followers, payload);
  } catch (e) {
    console.error("[ws] broadcastPresence error:", e);
  }
}

// ---------- Global bridge for API routes ----------
// Next.js API route'ları aynı Node process'inde çalışıyor; webpack bundle'ları farklı
// olduğu için global üzerinden köprü kuruyoruz. `src/lib/realtime/push.ts` bunu okur.
globalThis.__calium_ws = {
  sendToUser,
  sendToUsers,
  async broadcastToFollowers(userId, payload) {
    const ids = await getFollowerIdsOf(userId);
    return sendToUsers(ids, payload);
  },
};

// ---------- Bootstrap ----------
await app.prepare();
const stopIntegrationWorker = startWorker(prisma);

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url ?? "/", true);
  handle(req, res, parsedUrl);
});

const wss = new WebSocketServer({ noServer: true });
const nextUpgradeHandler = app.getUpgradeHandler();

server.on("upgrade", async (req, socket, head) => {
  const { pathname } = parse(req.url ?? "/", true);
  console.log(`[WS] Upgrade request received: ${pathname}`);
  if (pathname === "/ws" || pathname === "/ws/") {
    console.log("[WS] Authenticating...");
    const auth = await authenticateRequest(req);
    if (!auth) {
      console.log("[WS] Auth failed, rejecting socket");
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    console.log("[WS] Auth successful, upgrading...");
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, auth);
    });
    return;
  }
  // Next.js HMR ve diğer dahili upgrade'leri (_next/webpack-hmr, turbopack) Next'e devret
  try {
    await nextUpgradeHandler(req, socket, head);
  } catch (e) {
    console.error("[server] next upgrade handler error:", e);
    try {
      socket.destroy();
    } catch {}
  }
});

const ctx = {
  onPresenceChanged: (userId, state) => {
    broadcastPresence(userId, state).catch(() => {});
  },
  authorizeRoomJoin,
  authorizeRoomPlayback,
};

wss.on("connection", (ws, _req, auth) => {
  registerSocket(ws, auth.userId);
  sendHello(ws, auth.userId);

  // Default presence = online (mevcut aktiviteyi koruyarak)
  const nextState = setPresence(auth.userId, { status: "online" });
  ctx.onPresenceChanged(auth.userId, nextState);

  // Heartbeat
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    const raw = typeof data === "string" ? data : data.toString("utf8");
    // 64KB cap
    if (raw.length > 65_536) {
      ws.close(1009, "Message too large");
      return;
    }
    handleMessage(ws, raw, ctx).catch((e) => {
      console.error("[ws] handleMessage error:", e);
    });
  });

  ws.on("close", () => {
    const meta = getSocketMeta(ws);
    const userId = unregisterSocket(ws);
    if (userId && meta) {
      // Bu kullanıcının başka aktif soketi yoksa → offline yay
      // unregisterSocket zaten hub state'ini temizledi; isUserOnline(userId)=false olur.
      import("./src/server/ws/hub.mjs").then(({ isUserOnline }) => {
        if (!isUserOnline(userId)) {
          clearPresence(userId);
          broadcastPresence(userId, { status: "offline", activity: null }).catch(() => {});
        }
      });
    }
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {}
  }
}, 30_000);

wss.on("close", () => clearInterval(heartbeat));

server.listen(port, () => {
  console.log(`> Calium v0.6 ready on http://${hostname}:${port} (ws://.../ws)`);
});

// Graceful shutdown
function shutdown() {
  console.log("[server] shutting down...");
  clearInterval(heartbeat);
  stopIntegrationWorker();
  wss.close();
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ---------- API helper for routes: bildirim push ----------
// Route handler'lar, oluşturduktan sonra WS üzerinden push etmek isteyebilir.
// Route handler'lar ayrı process'te olmadığı için (aynı Node) doğrudan import edilen
// sendToUser kullanılabilir. Export edelim:
export { sendToUser, sendToUsers };
