// WS mesaj protokolü
//
// Client -> Server:
//   { t: "presence.update", status, activity? }
//   { t: "presence.subscribe", userIds: string[] }
//   { t: "room.join", roomId }
//   { t: "room.leave", roomId }
//   { t: "room.chat", roomId, text }
//   { t: "room.playback", roomId, action, data }
//   { t: "ping" }
//
// Server -> Client:
//   { t: "hello", userId }
//   { t: "presence.snapshot", entries: [{ userId, status, activity }] }
//   { t: "presence.event", userId, status, activity }
//   { t: "room.joined", roomId }
//   { t: "room.member", roomId, userId, event: "join"|"leave" }
//   { t: "room.chat", roomId, userId, text, ts }
//   { t: "room.playback", roomId, action, data, from }
//   { t: "error", code, message }
//   { t: "pong" }

import {
  broadcastToRoom,
  getPresence,
  getSocketMeta,
  joinRoom,
  leaveRoom,
  setPresence,
} from "./hub.mjs";

const MAX_CHAT_LEN = 500;
const VALID_STATUS = new Set(["online", "away", "dnd", "invisible"]);

/**
 * @param {import('ws').WebSocket} ws
 * @param {string} raw
 * @param {{
 *   onPresenceChanged: (userId: string, state: object) => void,
 *   authorizeRoomJoin: (userId: string, roomId: string) => Promise<{ ok: boolean, reason?: string, isHost?: boolean }>,
 *   authorizeRoomPlayback: (userId: string, roomId: string) => Promise<boolean>,
 * }} ctx
 */
export async function handleMessage(ws, raw, ctx) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return sendError(ws, "bad_json", "Invalid JSON");
  }
  const meta = getSocketMeta(ws);
  if (!meta) return sendError(ws, "no_session", "No session");
  const userId = meta.userId;

  switch (msg?.t) {
    case "ping":
      return ws.send(JSON.stringify({ t: "pong" }));

    case "presence.update": {
      const status = VALID_STATUS.has(msg.status) ? msg.status : "online";
      const activity = sanitizeActivity(msg.activity);
      const next = setPresence(userId, { status, activity });
      ctx.onPresenceChanged(userId, next);
      return;
    }

    case "presence.subscribe": {
      const ids = Array.isArray(msg.userIds) ? msg.userIds.slice(0, 200).map(String) : [];
      const entries = ids.map((id) => ({ userId: id, ...getPresence(id) }));
      return ws.send(JSON.stringify({ t: "presence.snapshot", entries }));
    }

    case "room.join": {
      const roomId = String(msg.roomId ?? "");
      if (!roomId) return sendError(ws, "bad_room", "roomId required");
      const auth = await ctx.authorizeRoomJoin(userId, roomId);
      if (!auth.ok) return sendError(ws, "forbidden", auth.reason ?? "Not allowed");
      joinRoom(ws, roomId);
      ws.send(JSON.stringify({ t: "room.joined", roomId }));
      broadcastToRoom(roomId, { t: "room.member", roomId, userId, event: "join" }, userId);
      return;
    }

    case "room.leave": {
      const roomId = String(msg.roomId ?? "");
      if (!roomId) return sendError(ws, "bad_room", "roomId required");
      leaveRoom(ws, roomId);
      broadcastToRoom(roomId, { t: "room.member", roomId, userId, event: "leave" }, userId);
      return;
    }

    case "room.chat": {
      const roomId = String(msg.roomId ?? "");
      const text = String(msg.text ?? "").slice(0, MAX_CHAT_LEN).trim();
      if (!roomId || !text) return;
      if (!meta.rooms.has(roomId)) return sendError(ws, "not_in_room", "Join room first");
      broadcastToRoom(roomId, { t: "room.chat", roomId, userId, text, ts: Date.now() });
      return;
    }

    case "room.playback": {
      const roomId = String(msg.roomId ?? "");
      if (!roomId || !meta.rooms.has(roomId)) return;
      const ok = await ctx.authorizeRoomPlayback(userId, roomId);
      if (!ok) return sendError(ws, "not_host", "Only host controls playback");
      const action = String(msg.action ?? "").slice(0, 32);
      if (!action) return;
      broadcastToRoom(
        roomId,
        { t: "room.playback", roomId, action, data: msg.data ?? null, from: userId },
        userId
      );
      return;
    }

    default:
      return sendError(ws, "unknown_type", `Unknown message type: ${msg?.t}`);
  }
}

export function sendHello(ws, userId) {
  ws.send(JSON.stringify({ t: "hello", userId }));
}

export function sendError(ws, code, message) {
  try {
    ws.send(JSON.stringify({ t: "error", code, message }));
  } catch {}
}

function sanitizeActivity(a) {
  if (!a || typeof a !== "object") return null;
  const kind = String(a.kind ?? "").slice(0, 32);
  if (!kind) return null;
  return {
    kind,
    animeId: a.animeId ? String(a.animeId).slice(0, 64) : null,
    animeTitle: a.animeTitle ? String(a.animeTitle).slice(0, 200) : null,
    episode: a.episode != null ? Number(a.episode) || null : null,
    episodeId: a.episodeId ? String(a.episodeId).slice(0, 64) : null,
    roomId: a.roomId ? String(a.roomId).slice(0, 64) : null,
  };
}
