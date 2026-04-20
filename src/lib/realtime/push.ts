// API route'lardan WS üzerinden push yapmak için ince köprü.
// Custom server (server.mjs) `globalThis.__calium_ws` atar. `next dev`/`next start`
// kullanılıyorsa (ws yok) çağrılar sessizce no-op olur.

type Bridge = {
  sendToUser: (userId: string, payload: unknown) => number;
  sendToUsers: (userIds: string[], payload: unknown) => number;
  broadcastToFollowers: (userId: string, payload: unknown) => Promise<number>;
};

function bridge(): Bridge | null {
  const g = globalThis as unknown as { __calium_ws?: Bridge };
  return g.__calium_ws ?? null;
}

export function pushToUser(userId: string, payload: unknown): number {
  return bridge()?.sendToUser(userId, payload) ?? 0;
}

export function pushToUsers(userIds: string[], payload: unknown): number {
  return bridge()?.sendToUsers(userIds, payload) ?? 0;
}

export async function pushToFollowers(userId: string, payload: unknown): Promise<number> {
  const b = bridge();
  if (!b) return 0;
  return b.broadcastToFollowers(userId, payload);
}

export function hasRealtimeBridge(): boolean {
  return bridge() !== null;
}
