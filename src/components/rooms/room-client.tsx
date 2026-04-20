"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { MediaPlayerInstance } from "@vidstack/react";
import { AnimePlayer } from "@/components/player/anime-player";
import { RoomChat, type ChatLine } from "@/components/rooms/room-chat";
import { useRoomSocket, type PlaybackEvent } from "@/lib/realtime/room";
import { usePresenceSubscribe } from "@/lib/realtime/presence";
import { PresenceDot } from "@/components/social/presence-dot";
import { ArrowLeft, Copy, DoorOpen, Loader2, LogOut, Shield, UserPlus, UserX, Crown, Globe, Lock, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceGroup, SubtitleData, SourceContent } from "@/lib/anizium/schemas";

type Member = {
  userId: string;
  role: string;
  user: { username: string; displayName: string | null; avatarUrl: string | null };
};

type Host = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

type InitialRoom = {
  id: string;
  code: string;
  hostId: string;
  animeId: string;
  animeName: string;
  episodeId: string;
  episodeName: string | null;
  poster: string | null;
  isPublic: boolean;
  endedAt: string | null;
  host: Host;
};

type Props = {
  initialRoom: InitialRoom;
  initialAccess: string;
  isHost: boolean;
  currentUser: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

type SourcesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; groups: SourceGroup[]; subtitles: SubtitleData[]; content: SourceContent | null };

export function RoomClient({ initialRoom, isHost, currentUser }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState<Member[]>([]);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [sources, setSources] = useState<SourcesState>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const suppressEventRef = useRef(false); // remote event uygulanırken event spam'ini kes
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const sendPlaybackRef = useRef<((a: PlaybackEvent["action"], d?: PlaybackEvent["data"]) => void) | null>(null);

  // --- 1) Ayar: üyelik ve ilk fetch ---
  // Private odalarda WS `room.join` authorize'u DB'den member bakıyor.
  // WS bağlantısı fetch tamamlanmadan açılırsa "Davet gerekli" ile reddedilir.
  // Bu yüzden host değilse önce `/join` tamamlansın, sonra WS'i aç.
  const [memberReady, setMemberReady] = useState(isHost);
  useEffect(() => {
    if (isHost) {
      setMemberReady(true);
      refreshRoom();
      return;
    }
    (async () => {
      try {
        await fetch(`/api/rooms/${room.id}/join`, { method: "POST" });
      } catch {}
      setMemberReady(true);
      refreshRoom();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}`);
      const data = await res.json();
      if (data.success && data.room) {
        setMembers(data.room.members ?? []);
      }
    } catch {}
  }, [room.id]);

  // --- 2) Kaynakları yükle (episode değişiminde tekrar) ---
  useEffect(() => {
    setSources({ status: "loading" });
    const ctrl = new AbortController();
    (async () => {
      try {
        // Bölüm numarası gerekli — anime detayından çöz
        const detRes = await fetch(`/api/anizium/anime/${encodeURIComponent(room.animeId)}`, {
          signal: ctrl.signal,
        });
        const det = await detRes.json();
        if (!detRes.ok || det?.success === false || !det?.data) {
          setSources({
            status: "error",
            message: det?.error ?? "Anime bilgisi alınamadı.",
          });
          return;
        }
        let seasonNum = 1;
        let episodeNum = 1;
        let matched = false;
        outer: for (const s of det.data.seasons ?? []) {
          for (const ep of s.episodes ?? []) {
            if (ep.ID === room.episodeId) {
              seasonNum = Number(s.number) || 1;
              episodeNum = Number(ep.number) || 1;
              matched = true;
              break outer;
            }
          }
        }
        // Film senaryosu: episodeId "film" olabilir veya tek sezon yapısı
        if (!matched && room.episodeId === "film") {
          seasonNum = 1;
          episodeNum = 1;
        }
        const r = await fetch(
          `/api/anizium/episode?animeId=${encodeURIComponent(room.animeId)}&season=${seasonNum}&episode=${episodeNum}`,
          { signal: ctrl.signal, cache: "no-store" }
        );
        const json = await r.json();
        if (!r.ok || json?.success === false) {
          setSources({ status: "error", message: json?.error ?? "Kaynak alınamadı." });
          return;
        }
        const groups: SourceGroup[] = (json.groups ?? []).filter(
          (g: SourceGroup) => g.items && g.items.length > 0
        );
        setSources({
          status: "ready",
          groups,
          subtitles: json.subtitles ?? [],
          content: json.content ?? null,
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSources({ status: "error", message: (e as Error).message });
      }
    })();
    return () => ctrl.abort();
  }, [room.animeId, room.episodeId]);

  // --- 3) WS ---
  const onChat = useCallback(
    (m: { userId: string; text: string; ts: number }) => {
      const mem = members.find((x) => x.userId === m.userId);
      const host = m.userId === room.hostId ? room.host : null;
      setLines((prev) => [
        ...prev,
        {
          id: `${m.ts}-${m.userId}`,
          userId: m.userId,
          username: mem?.user.username ?? host?.username ?? m.userId.slice(0, 6),
          displayName: mem?.user.displayName ?? host?.displayName ?? null,
          avatarUrl: mem?.user.avatarUrl ?? host?.avatarUrl ?? null,
          text: m.text,
          ts: m.ts,
        },
      ]);
    },
    [members, room.host, room.hostId]
  );

  const onMember = useCallback(
    (m: { userId: string; event: "join" | "leave" }) => {
      setLines((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}-${m.userId}`,
          userId: "system",
          username: "",
          displayName: null,
          text:
            m.event === "join"
              ? "Bir kullanıcı odaya katıldı."
              : "Bir kullanıcı odadan ayrıldı.",
          ts: Date.now(),
          system: true,
        },
      ]);
      refreshRoom();
      // Host ise yeni katılana anında sync gönder
      if (m.event === "join" && isHostRef.current) {
        const p = playerRef.current;
        if (p) {
          const time = p.currentTime;
          const paused = p.paused;
          // Biraz gecikme ile gönder (guest'in WS room.joined almasını bekle)
          setTimeout(() => {
            if (paused) {
              sendPlaybackRef.current?.("pause", { time });
            } else {
              sendPlaybackRef.current?.("play", { time });
            }
          }, 600);
        }
      }
    },
    [refreshRoom]
  );

  const [mutedByAutoplay, setMutedByAutoplay] = useState(false);

  const onPlayback = useCallback((e: PlaybackEvent) => {
    const p = playerRef.current;
    if (!p) return;
    if (isHostRef.current) return; // host kendine uygulamaz
    suppressEventRef.current = true;
    const d = e.data ?? {};
    try {
      if (e.action === "play") {
        if (typeof d.time === "number") p.currentTime = d.time;
        // Autoplay policy: muted olmazsa reddedilebilir — mute fallback.
        p.play().catch(() => {
          try {
            p.muted = true;
            setMutedByAutoplay(true);
            void p.play().catch(() => {});
          } catch {}
        });
      } else if (e.action === "pause") {
        if (typeof d.time === "number") p.currentTime = d.time;
        p.pause();
      } else if (e.action === "seek") {
        if (typeof d.time === "number") {
          const drift = Math.abs(p.currentTime - d.time);
          if (drift > 0.5) p.currentTime = d.time;
        }
      } else if (e.action === "sync") {
        if (typeof d.time === "number") {
          const drift = Math.abs(p.currentTime - d.time);
          if (drift > 1.5) p.currentTime = d.time;
        }
      }
    } finally {
      setTimeout(() => {
        suppressEventRef.current = false;
      }, 300);
    }
  }, []);

  const onUpdate = useCallback((u: { episodeId: string; episodeName: string | null }) => {
    setRoom((r) => ({ ...r, episodeId: u.episodeId, episodeName: u.episodeName }));
  }, []);

  const onKicked = useCallback(() => {
    alert("Odadan çıkarıldın.");
    router.replace("/arkadaslar");
  }, [router]);

  const onClosed = useCallback(() => {
    alert("Oda host tarafından kapatıldı.");
    router.replace("/arkadaslar");
  }, [router]);

  const { ready, sendChat, sendPlayback } = useRoomSocket(memberReady ? room.id : null, {
    onChat,
    onMember,
    onPlayback,
    onUpdate,
    onKicked,
    onClosed,
  });
  sendPlaybackRef.current = sendPlayback;

  // --- 4) Host → guest playback yayınla (imperative listen) ---
  useEffect(() => {
    if (!playerReady) return;
    const p = playerRef.current;
    if (!p) return;
    // Sadece host gönderir; guest tarafında dinlemeye gerek yok.
    if (!isHost) return;

    const offPlay = p.listen("play", () => {
      if (suppressEventRef.current) return;
      sendPlayback("play", { time: p.currentTime });
    });
    const offPause = p.listen("pause", () => {
      if (suppressEventRef.current) return;
      sendPlayback("pause", { time: p.currentTime });
    });
    const offSeeked = p.listen("seeked", () => {
      if (suppressEventRef.current) return;
      sendPlayback("seek", { time: p.currentTime });
    });
    return () => {
      offPlay();
      offPause();
      offSeeked();
    };
  }, [playerReady, isHost, sendPlayback]);

  // Periyodik sync (host)
  useEffect(() => {
    if (!isHost || !ready || !playerReady) return;
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      sendPlayback("sync", { time: p.currentTime });
    }, 10_000);
    return () => clearInterval(iv);
  }, [isHost, ready, playerReady, sendPlayback]);

  // --- 5) Üye listesi presence ---
  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const presence = usePresenceSubscribe(memberIds);

  // --- 6) Aksiyonlar ---
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/oda/${room.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function leaveRoom() {
    if (isHost && !confirm("Host olarak ayrılırsan oda kapanır. Emin misin?")) return;
    await fetch(`/api/rooms/${room.id}/leave`, { method: "POST" });
    router.replace("/arkadaslar");
  }

  async function kickUser(userId: string, ban = false) {
    if (!confirm(ban ? "Kullanıcıyı banla?" : "Kullanıcıyı at?")) return;
    await fetch(`/api/rooms/${room.id}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ban }),
    });
    refreshRoom();
  }

  async function inviteUser(username: string) {
    const res = await fetch(`/api/rooms/${room.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (data.success) {
      alert("Davet gönderildi.");
    } else {
      alert(data.error ?? "Gönderilemedi.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      {/* Üst bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/anime/${encodeURIComponent(room.animeId)}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" /> {room.animeName}
        </Link>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs">
          {room.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {room.isPublic ? "Açık oda" : "Özel oda"}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
        >
          <Copy className="h-3 w-3" /> {copied ? "Kopyalandı!" : `Kod: ${room.code}`}
        </button>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
        >
          <UserPlus className="h-3 w-3" /> Davet et
        </button>
        <button
          type="button"
          onClick={leaveRoom}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/15"
        >
          {isHost ? <DoorOpen className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
          {isHost ? "Odayı kapat" : "Ayrıl"}
        </button>
      </div>

      {showInvite && (
        <InvitePanel
          onSend={(u) => {
            inviteUser(u);
            setShowInvite(false);
          }}
          onClose={() => setShowInvite(false)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Oynatıcı */}
        <div>
          {sources.status === "loading" && (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
            </div>
          )}
          {sources.status === "error" && (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted-foreground)]">
              {sources.message}
            </div>
          )}
          {sources.status === "ready" && (
            <div className={cn(!isHost && "[&_.anizium-player]:pointer-events-none")}>
              <AnimePlayer
                groups={sources.groups}
                subtitles={sources.subtitles}
                poster={room.poster}
                title={`${room.animeName}${room.episodeName ? ` — ${room.episodeName}` : ""}`}
                onPlayerReady={(p) => {
                  playerRef.current = p;
                  setPlayerReady(true);
                }}
              />
              {!isHost && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <span>
                    <Shield className="mr-1 inline h-3 w-3" /> Oynatmayı host yönetir.
                  </span>
                  {mutedByAutoplay && (
                    <button
                      type="button"
                      onClick={() => {
                        const p = playerRef.current;
                        if (!p) return;
                        try {
                          p.muted = false;
                          setMutedByAutoplay(false);
                        } catch {}
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2.5 py-1 text-[var(--primary)] hover:bg-[var(--primary)]/15"
                    >
                      <Volume2 className="h-3 w-3" /> Sesi aç
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <h2 className="text-sm font-semibold">Üyeler ({members.length})</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {members.map((m) => {
                const p = presence.get(m.userId);
                const status = p?.status ?? "offline";
                const isRoomHost = m.userId === room.hostId;
                return (
                  <li
                    key={m.userId}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2"
                  >
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--muted)]">
                      {m.user.avatarUrl ? (
                        <Image
                          src={m.user.avatarUrl}
                          alt={m.user.username}
                          width={36}
                          height={36}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--muted-foreground)]">
                          {(m.user.displayName || m.user.username).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <PresenceDot
                        status={status}
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium">
                          {m.user.displayName || m.user.username}
                        </span>
                        {isRoomHost && <Crown className="h-3 w-3 text-amber-500" />}
                      </div>
                      <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                        @{m.user.username}
                      </p>
                    </div>
                    {isHost && !isRoomHost && m.userId !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => kickUser(m.userId, false)}
                        aria-label="At"
                        className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Chat */}
        <aside className="h-[calc(100dvh-200px)] min-h-[420px] lg:h-auto lg:max-h-[800px]">
          <RoomChat lines={lines} onSend={sendChat} currentUserId={currentUser.id} />
        </aside>
      </div>
    </div>
  );
}

function InvitePanel({
  onSend,
  onClose,
}: {
  onSend: (username: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <div className="mb-3 flex gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Kullanıcı adı"
        className="flex-1 h-9 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--primary)]"
      />
      <button
        type="button"
        onClick={() => {
          const u = q.trim().replace(/^@/, "");
          if (u.length >= 2) onSend(u);
        }}
        className="rounded-full bg-[var(--primary)] px-4 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
      >
        Gönder
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm"
      >
        İptal
      </button>
    </div>
  );
}
