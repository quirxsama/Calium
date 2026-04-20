"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

export type ChatLine = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  text: string;
  ts: number;
  system?: boolean;
};

type Props = {
  lines: ChatLine[];
  onSend: (text: string) => void;
  currentUserId: string;
};

export function RoomChat({ lines, onSend, currentUserId }: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">Sohbet</div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {lines.length === 0 && (
          <p className="text-center text-xs text-[var(--muted-foreground)]">Henüz mesaj yok.</p>
        )}
        {lines.map((l) => {
          if (l.system) {
            return (
              <p key={l.id} className="text-center text-[11px] italic text-[var(--muted-foreground)]">
                {l.text}
              </p>
            );
          }
          const self = l.userId === currentUserId;
          return (
            <div key={l.id} className={self ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  self
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-[var(--muted)] px-3 py-1.5 text-sm"
                }
              >
                {!self && (
                  <p className="text-[11px] font-semibold text-[var(--primary)]">
                    {l.displayName || l.username}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{l.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-[var(--border)] p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Mesaj yaz…"
          className="flex-1 h-9 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)]"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Gönder"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
