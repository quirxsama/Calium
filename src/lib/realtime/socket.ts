"use client";

// Tek paylaşımlı WebSocket bağlantısı. Modül seviyesinde singleton.
// Kullanım:
//   const { send, subscribe } = getRealtimeSocket();
//   const off = subscribe((msg) => { ... });

type Listener = (msg: Record<string, unknown>) => void;

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let backoff = 1000;
const listeners = new Set<Listener>();
let queue: string[] = [];

function url(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

function connect() {
  if (typeof window === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(url());
  } catch {
    scheduleReconnect();
    return;
  }
  ws.addEventListener("open", () => {
    backoff = 1000;
    for (const q of queue) ws?.send(q);
    queue = [];
  });
  ws.addEventListener("message", (ev) => {
    let msg: Record<string, unknown> | null = null;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (!msg) return;
    for (const l of listeners) {
      try {
        l(msg);
      } catch {}
    }
  });
  ws.addEventListener("close", () => {
    scheduleReconnect();
  });
  ws.addEventListener("error", () => {
    try {
      ws?.close();
    } catch {}
  });
}

function scheduleReconnect() {
  if (reconnectTimer != null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    backoff = Math.min(backoff * 2, 30_000);
    connect();
  }, backoff);
}

export function getRealtimeSocket() {
  if (typeof window !== "undefined") connect();
  return {
    send(payload: unknown) {
      const raw = JSON.stringify(payload);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(raw);
      else queue.push(raw);
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    close() {
      try {
        ws?.close();
      } catch {}
      ws = null;
    },
    readyState(): number {
      return ws?.readyState ?? WebSocket.CLOSED;
    },
  };
}
