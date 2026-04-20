// WebSocket hub — in-process. PM2 cluster için Redis pub/sub'a geçilebilir.
// Yapı:
//   clientsByUser: Map<userId, Set<WebSocket>>
//   roomMembers:   Map<roomId, Set<userId>>
//   userPresence:  Map<userId, { status, activity, updatedAt }>

const clientsByUser = new Map();
const roomMembers = new Map();
const userPresence = new Map();
const socketMeta = new WeakMap(); // ws -> { userId, rooms:Set<string> }

export function registerSocket(ws, userId) {
  socketMeta.set(ws, { userId, rooms: new Set() });
  if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
  clientsByUser.get(userId).add(ws);
}

export function unregisterSocket(ws) {
  const meta = socketMeta.get(ws);
  if (!meta) return null;
  const set = clientsByUser.get(meta.userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) clientsByUser.delete(meta.userId);
  }
  for (const roomId of meta.rooms) {
    leaveRoom(ws, roomId);
  }
  socketMeta.delete(ws);
  return meta.userId;
}

export function getSocketMeta(ws) {
  return socketMeta.get(ws) ?? null;
}

export function sendToUser(userId, payload) {
  const set = clientsByUser.get(userId);
  if (!set) return 0;
  const msg = JSON.stringify(payload);
  let n = 0;
  for (const ws of set) {
    if (ws.readyState === 1) {
      ws.send(msg);
      n++;
    }
  }
  return n;
}

export function sendToUsers(userIds, payload) {
  let n = 0;
  for (const uid of userIds) n += sendToUser(uid, payload);
  return n;
}

export function isUserOnline(userId) {
  const set = clientsByUser.get(userId);
  return !!(set && set.size > 0);
}

export function getOnlineUserIds(userIds) {
  return userIds.filter((id) => isUserOnline(id));
}

// ---- Presence ----
export function setPresence(userId, patch) {
  const prev = userPresence.get(userId) ?? { status: "online", activity: null };
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  userPresence.set(userId, next);
  return next;
}

export function getPresence(userId) {
  if (!isUserOnline(userId)) return { status: "offline", activity: null, updatedAt: 0 };
  return userPresence.get(userId) ?? { status: "online", activity: null, updatedAt: Date.now() };
}

export function clearPresence(userId) {
  userPresence.delete(userId);
}

// ---- Rooms ----
export function joinRoom(ws, roomId) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  meta.rooms.add(roomId);
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
  roomMembers.get(roomId).add(meta.userId);
}

export function leaveRoom(ws, roomId) {
  const meta = socketMeta.get(ws);
  if (!meta) return;
  meta.rooms.delete(roomId);
  // userId hala bu odada başka soketle bağlıysa çıkarma
  let stillHere = false;
  const userSockets = clientsByUser.get(meta.userId);
  if (userSockets) {
    for (const s of userSockets) {
      const m = socketMeta.get(s);
      if (m && m.rooms.has(roomId)) {
        stillHere = true;
        break;
      }
    }
  }
  if (!stillHere) {
    const mem = roomMembers.get(roomId);
    if (mem) {
      mem.delete(meta.userId);
      if (mem.size === 0) roomMembers.delete(roomId);
    }
  }
}

export function getRoomMemberIds(roomId) {
  return Array.from(roomMembers.get(roomId) ?? []);
}

export function broadcastToRoom(roomId, payload, exceptUserId = null) {
  const members = roomMembers.get(roomId);
  if (!members) return 0;
  let n = 0;
  for (const uid of members) {
    if (uid === exceptUserId) continue;
    n += sendToUser(uid, payload);
  }
  return n;
}
