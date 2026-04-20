"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { MediaPlayerInstance } from "@vidstack/react";
import { AnimePlayer } from "@/components/player/anime-player";
import { RoomChat, type ChatLine } from "@/components/rooms/room-chat";
import { useRoomSocket, type PlaybackEvent } from "@/lib/realtime/room";
import { usePresenceSubscribe } from "@/lib/realtime/presence";
import { usePublishActivity } from "@/lib/realtime/presence";
import { PresenceDot } from "@/components/social/presence-dot";
import { ArrowLeft, Check, Copy, DoorOpen, Link2, Loader2, LogOut, Shield, UserPlus, UserX, Crown, Globe, Lock, Volume2 } from "lucide-react";
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
  const searchParams = useSearchParams();
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState<Member[]>([]);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [sources, setSources] = useState<SourcesState>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [copiedWhat, setCopiedWhat] = useState<"link" | "code" | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const suppressEventRef = useRef(false); // remote event uygulanırken event spam'ini kes
  const remoteSeekRef = useRef<number | null>(null);
  const remotePausedRef = useRef(true);
  const lastRemoteSyncAtRef = useRef(0);
  const remoteClockRef = useRef<{ time: number; sentAt: number } | null>(null);
  const isHostRef = useRef(isHost);
  const sendPlaybackRef = useRef<((a: PlaybackEvent["action"], d?: PlaybackEvent["data"]) => void) | null>(null);

  usePublishActivity({
    kind: "in_room",
    animeId: room.animeId,
    animeTitle: room.animeName,
    episode: room.episodeName ? undefined : null,
    roomId: room.id,
  });

  function safePlay(player: MediaPlayerInstance) {
    try {
      const result = player.play();
      if (result && typeof (result as PromiseLike<void>).then === "function") {
        void (result as Promise<void>).catch(() => {});
      }
    } catch {}
  }

  function safePause(player: MediaPlayerInstance) {
    try {
      player.pause();
    } catch {}
  }

  const refreshRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}`);
      const data = await res.json();
      if (data.success && data.room) {
        setMembers(data.room.members ?? []);
      }
    } catch {}
  }, [room.id]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // --- 1) Ayar: üyelik ve ilk fetch ---
  // Private odalarda WS `room.join` authorize'u DB'den member bakıyor.
  // WS bağlantısı fetch tamamlanmadan açılırsa "Davet gerekli" ile reddedilir.
  // Bu yüzden host değilse önce `/join` tamamlansın, sonra WS'i aç.
  const [memberReady, setMemberReady] = useState(isHost);
  useEffect(() => {
    if (isHost) {
      queueMicrotask(() => {
        void refreshRoom();
      });
      return;
    }
    (async () => {
      try {
        const code = searchParams.get("code")?.trim() || undefined;
        await fetch(`/api/rooms/${room.id}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(code ? { code } : {}),
        });
      } catch {}
      setMemberReady(true);
      void refreshRoom();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2) Kaynakları yükle (episode değişiminde tekrar) ---
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSources({ status: "loading" });
    });
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
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [room.animeId, room.episodeId]);

  // --- 3) WS ---
  const onChat = useCallback(
    (m: { userId: string; text: string; ts: number }) => {
      const mem = members.find((x) => x.userId === m.userId);
      const host = m.userId === room.hostId ? room.host : null;
      const fallbackName = m.userId === currentUser.id
        ? currentUser.displayName || currentUser.username
        : mem?.user.displayName || mem?.user.username || host?.displayName || host?.username || "Misafir";
      setLines((prev) => [
        ...prev,
        {
          id: `${m.ts}-${m.userId}`,
          userId: m.userId,
          username: mem?.user.username ?? host?.username ?? currentUser.username,
          displayName: fallbackName,
          avatarUrl: mem?.user.avatarUrl ?? host?.avatarUrl ?? null,
          text: m.text,
          ts: m.ts,
        },
      ]);
    },
    [currentUser.displayName, currentUser.id, currentUser.username, members, room.host, room.hostId]
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
      const sentAt = typeof d.sentAt === "number" ? d.sentAt : Date.now();
      if (sentAt < lastRemoteSyncAtRef.current) return;
      lastRemoteSyncAtRef.current = sentAt;

      const setRemoteClock = (time: number) => {
        remoteSeekRef.current = time;
        remoteClockRef.current = { time, sentAt };
      };

      if (e.action === "play") {
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          p.currentTime = d.time;
        }
        remotePausedRef.current = false;
        // Autoplay policy: muted olmazsa reddedilebilir — mute fallback.
        try {
          const result = p.play();
          if (result && typeof (result as PromiseLike<void>).then === "function") {
            void (result as Promise<void>).catch(() => {
              try {
                p.muted = true;
                setMutedByAutoplay(true);
                safePlay(p);
              } catch {}
            });
          }
        } catch {
          try {
            p.muted = true;
            setMutedByAutoplay(true);
            safePlay(p);
          } catch {}
        }
      } else if (e.action === "pause") {
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          p.currentTime = d.time;
        }
        remotePausedRef.current = true;
        safePause(p);
      } else if (e.action === "seek") {
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          const drift = Math.abs(p.currentTime - d.time);
          if (drift > 0.9) {
            p.currentTime = d.time;
          }
        }
      } else if (e.action === "sync") {
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          const drift = Math.abs(p.currentTime - d.time);
          if (drift > 2.25) {
            p.currentTime = d.time;
          }
        }
        if (typeof d.paused === "boolean") {
          remotePausedRef.current = d.paused;
          if (d.paused && !p.paused) safePause(p);
          if (!d.paused && p.paused) {
            safePlay(p);
          }
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

  useEffect(() => {
    sendPlaybackRef.current = sendPlayback;
  }, [sendPlayback]);

  // --- 4) Host → guest playback yayınla (imperative listen) ---
  useEffect(() => {
    if (!playerReady) return;
    const p = playerRef.current;
    if (!p) return;
    // Sadece host gönderir; guest tarafında dinlemeye gerek yok.
    if (!isHost) return;

    const offPlay = p.listen("play", () => {
      if (suppressEventRef.current) return;
      sendPlayback("play", { time: p.currentTime, paused: false, sentAt: Date.now() });
    });
    const offPause = p.listen("pause", () => {
      if (suppressEventRef.current) return;
      sendPlayback("pause", { time: p.currentTime, paused: true, sentAt: Date.now() });
    });
    const offSeeked = p.listen("seeked", () => {
      if (suppressEventRef.current) return;
      sendPlayback("seek", { time: p.currentTime, paused: p.paused, sentAt: Date.now() });
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
      sendPlayback("sync", { time: p.currentTime, paused: p.paused, sentAt: Date.now() });
    }, 10_000);
    return () => clearInterval(iv);
  }, [isHost, ready, playerReady, sendPlayback]);

  useEffect(() => {
    if (isHost || !playerReady) return;
    const iv = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      if (remotePausedRef.current && !p.paused) {
        safePause(p);
        return;
      }
      if (!remotePausedRef.current && p.paused) {
        safePlay(p);
      }
      const clock = remoteClockRef.current;
      const target = clock
        ? clock.time + Math.max(0, (Date.now() - clock.sentAt) / 1000)
        : remoteSeekRef.current;
      if (target == null || p.paused) return;
      const drift = Math.abs(p.currentTime - target);
      if (drift > 2.4) {
        p.currentTime = target;
      }
    }, 1500);
    return () => {
      window.clearInterval(iv);
    };
  }, [isHost, playerReady]);

  useEffect(() => {
    if (isHost || !playerReady) return;
    const p = playerRef.current;
    if (!p) return;

    const resyncPlayback = () => {
      if (suppressEventRef.current) return;
      suppressEventRef.current = true;
      try {
        const clock = remoteClockRef.current;
        const target = clock
          ? clock.time + Math.max(0, (Date.now() - clock.sentAt) / 1000)
          : remoteSeekRef.current;
        if (typeof target === "number" && Math.abs(p.currentTime - target) > 2.8) {
          p.currentTime = target;
        }
        if (remotePausedRef.current) {
          if (!p.paused) safePause(p);
        } else if (p.paused) {
          safePlay(p);
        }
      } finally {
        window.setTimeout(() => {
          suppressEventRef.current = false;
        }, 120);
      }
    };

    const offPlay = p.listen("play", resyncPlayback);
    const offPause = p.listen("pause", resyncPlayback);
    const offSeeked = p.listen("seeked", resyncPlayback);

    return () => {
      offPlay();
      offPause();
      offSeeked();
    };
  }, [isHost, playerReady]);

  // --- 5) Üye listesi presence ---
  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const presence = usePresenceSubscribe(memberIds);

  // --- 6) Aksiyonlar ---
  async function copyText(value: string, kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopiedWhat(kind);
      setTimeout(() => {
        setCopied(false);
        setCopiedWhat(null);
      }, 1500);
    } catch {}
  }

  async function generateInviteLink() {
    setInviteBusy(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.invite?.inviteUrl) {
        const absolute = `${location.origin}${data.invite.inviteUrl}`;
        setInviteLink(absolute);
        await copyText(absolute, "link");
      }
    } finally {
      setInviteBusy(false);
    }
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
      if (data.invite?.inviteUrl) {
        setInviteLink(`${location.origin}${data.invite.inviteUrl}`);
      }
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
          onClick={() => void copyText(room.code, "code")}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)]"
        >
          <Copy className="h-3 w-3" /> {copied && copiedWhat === "code" ? "Kod kopyalandı!" : `Kod: ${room.code}`}
        </button>
        <button
          type="button"
          onClick={() => void generateInviteLink()}
          disabled={inviteBusy}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] disabled:opacity-60"
        >
          {inviteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
          {copied && copiedWhat === "link" ? "Bağlantı kopyalandı!" : "Davet linki"}
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
          inviteCode={room.code}
          inviteLink={inviteLink}
          onCopyCode={() => void copyText(room.code, "code")}
          onCopyLink={() => inviteLink ? void copyText(inviteLink, "link") : void generateInviteLink()}
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
            <div className={cn("relative") }>
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
  inviteCode,
  inviteLink,
  onCopyCode,
  onCopyLink,
  onSend,
  onClose,
}: {
  inviteCode: string;
  inviteLink: string | null;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onSend: (username: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Kullanıcı adıyla davet</p>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kullanıcı adı (opsiyonel)"
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
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <p className="font-medium text-[var(--muted-foreground)]">Kod veya bağlantı ile katılım</p>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span className="font-semibold tracking-[0.2em]">{inviteCode}</span>
            <button type="button" onClick={onCopyCode} className="ml-auto text-[var(--primary)] hover:opacity-80">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
          >
            {inviteLink ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {inviteLink ? "Bağlantıyı tekrar kopyala" : "Bağlantı oluştur ve kopyala"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
