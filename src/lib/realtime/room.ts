"use client";

import { useEffect, useRef, useState } from "react";
import { getRealtimeSocket } from "./socket";

export type ChatMsg = {
  userId: string;
  text: string;
  ts: number;
};

export type PlaybackEvent = {
  action: "play" | "pause" | "seek" | "rate" | "sync";
  data?: { time?: number; rate?: number };
  from?: string;
};

export type RoomMemberEvent = {
  userId: string;
  event: "join" | "leave";
};

type Handlers = {
  onChat?: (m: ChatMsg) => void;
  onMember?: (m: RoomMemberEvent) => void;
  onPlayback?: (e: PlaybackEvent) => void;
  onUpdate?: (u: { episodeId: string; episodeName: string | null }) => void;
  onKicked?: (p: { banned: boolean }) => void;
  onClosed?: () => void;
};

/**
 * Odaya WS üzerinden katılır, mesaj tiplerini ilgili handler'lara dağıtır.
 * Unmount'ta `room.leave` gönderir.
 */
export function useRoomSocket(roomId: string | null, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const sock = getRealtimeSocket();

    function join() {
      sock.send({ t: "room.join", roomId });
    }

    function onEvent(e: Event) {
      const msg = (e as CustomEvent).detail as Record<string, unknown>;
      if (!msg) return;
      if (msg.roomId && msg.roomId !== roomId) return;
      const h = handlersRef.current;
      switch (msg.t) {
        case "room.joined":
          setReady(true);
          return;
        case "room.chat":
          h.onChat?.({ userId: String(msg.userId), text: String(msg.text), ts: Number(msg.ts) });
          return;
        case "room.member":
          h.onMember?.({ userId: String(msg.userId), event: msg.event as "join" | "leave" });
          return;
        case "room.playback":
          h.onPlayback?.({
            action: msg.action as PlaybackEvent["action"],
            data: (msg.data ?? null) as PlaybackEvent["data"],
            from: msg.from ? String(msg.from) : undefined,
          });
          return;
        case "room.update":
          h.onUpdate?.({
            episodeId: String(msg.episodeId),
            episodeName: (msg.episodeName as string | null) ?? null,
          });
          return;
        case "room.kicked":
          h.onKicked?.({ banned: Boolean(msg.banned) });
          return;
        case "room.closed":
          h.onClosed?.();
          return;
      }
    }

    window.addEventListener("calium:room-event", onEvent);
    join();
    const focusHandler = () => join();
    window.addEventListener("focus", focusHandler);

    return () => {
      window.removeEventListener("calium:room-event", onEvent);
      window.removeEventListener("focus", focusHandler);
      sock.send({ t: "room.leave", roomId });
      setReady(false);
    };
  }, [roomId]);

  return {
    ready,
    sendChat(text: string) {
      const t = text.trim();
      if (!t || !roomId) return;
      getRealtimeSocket().send({ t: "room.chat", roomId, text: t });
    },
    sendPlayback(action: PlaybackEvent["action"], data?: PlaybackEvent["data"]) {
      if (!roomId) return;
      getRealtimeSocket().send({ t: "room.playback", roomId, action, data: data ?? null });
    },
  };
}
