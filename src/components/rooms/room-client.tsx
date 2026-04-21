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
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, DoorOpen, Link2, Loader2, LogOut, MessageSquare, Play, Search, Shield, UserPlus, UserX, Crown, Globe, Lock, Volume2, X } from "lucide-react";
import { cn, parseTimeCode } from "@/lib/utils";
import type { SourceGroup, SubtitleData, SourceContent, EpisodeData } from "@/lib/anizium/schemas";
import { useConfirm } from "@/components/ui/confirm-dialog";

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
  hostLeftAt: string | null;
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

type FriendItem = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
type InviteMini = { id: string; inviteId?: string; roomId?: string; inviteUrl?: string; animeName?: string; username?: string; displayName?: string | null };
type AlertState = { open: boolean; title: string; description?: string };

export function RoomClient({ initialRoom, isHost, currentUser }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm } = useConfirm();
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState<Member[]>([]);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [sources, setSources] = useState<SourcesState>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [copiedWhat, setCopiedWhat] = useState<"link" | "code" | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOverlayEnabled, setChatOverlayEnabled] = useState(true);
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
  const [visibleOverlayLineIds, setVisibleOverlayLineIds] = useState<string[]>([]);
  const [overlayLineExitIds, setOverlayLineExitIds] = useState<string[]>([]);
  const [miniInvite, setMiniInvite] = useState<InviteMini | null>(null);
  const [miniInviteCollapsed, setMiniInviteCollapsed] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<EpisodeData[]>([]);
  const [showEpisodePicker, setShowEpisodePicker] = useState(false);
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const suppressEventRef = useRef(false); // remote event uygulanırken event spam'ini kes
  const remoteSeekRef = useRef<number | null>(null);
  const remotePausedRef = useRef(true);
  const lastRemoteSyncAtRef = useRef(0);
  const remoteClockRef = useRef<{ time: number; sentAt: number } | null>(null);
  const lastEpisodeUpdateAtRef = useRef(0);
  const pendingPlaybackResumeRef = useRef<{ paused: boolean; time: number } | null>(null);
  const isHostRef = useRef(isHost);
  const sendPlaybackRef = useRef<((a: PlaybackEvent["action"], d?: PlaybackEvent["data"]) => void) | null>(null);
  const inviteShrinkTimerRef = useRef<number | null>(null);
  const overlayLineTimersRef = useRef<Map<string, { exitTimer: number; removeTimer: number }>>(new Map());
  const [roomAlert, setRoomAlert] = useState<AlertState>({ open: false, title: "" });

  const showRoomAlert = useCallback((title: string, description?: string) => {
    setRoomAlert({ open: true, title, description });
  }, []);

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

  const updateMiniInvite = useCallback((entry: InviteMini | null) => {
    if (inviteShrinkTimerRef.current) {
      window.clearTimeout(inviteShrinkTimerRef.current);
      inviteShrinkTimerRef.current = null;
    }
    setMiniInvite(entry);
    setMiniInviteCollapsed(false);
    if (entry) {
      inviteShrinkTimerRef.current = window.setTimeout(() => {
        setMiniInviteCollapsed(true);
      }, 3000);
    }
  }, []);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const activeOverlayLines = lines.filter((line) => !line.system).slice(-5);
    const timerMap = overlayLineTimersRef.current;

    for (const line of activeOverlayLines) {
      if (timerMap.has(line.id)) continue;

      setVisibleOverlayLineIds((prev) => (prev.includes(line.id) ? prev : [...prev, line.id]));
      setOverlayLineExitIds((prev) => prev.filter((id) => id !== line.id));

      const exitTimer = window.setTimeout(() => {
        setOverlayLineExitIds((prev) => (prev.includes(line.id) ? prev : [...prev, line.id]));
      }, 2600);

      const removeTimer = window.setTimeout(() => {
        setVisibleOverlayLineIds((prev) => prev.filter((id) => id !== line.id));
        setOverlayLineExitIds((prev) => prev.filter((id) => id !== line.id));
        timerMap.delete(line.id);
      }, 3000);

      timerMap.set(line.id, { exitTimer, removeTimer });
    }

  }, [lines]);

  useEffect(() => {
    const timerMap = overlayLineTimersRef.current;
    return () => {
      for (const timers of timerMap.values()) {
        window.clearTimeout(timers.exitTimer);
        window.clearTimeout(timers.removeTimer);
      }
      timerMap.clear();
    };
  }, []);

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
        const res = await fetch(`/api/rooms/${room.id}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(code ? { code } : {}),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          showRoomAlert("Odaya katılamadın", data?.error ?? "Odaya katılmak için izin gerekli.");
          router.replace("/arkadaslar");
          return;
        }
        setMemberReady(true);
        void refreshRoom();
      } catch {
        showRoomAlert("Odaya katılırken hata oluştu", "Lütfen biraz sonra tekrar dene.");
        router.replace("/arkadaslar");
      }
    })();
  }, [isHost, refreshRoom, room.id, router, searchParams, showRoomAlert]);

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
              setSeasonEpisodes(s.episodes ?? []);
              seasonNum = Number(s.number) || 1;
              episodeNum = Number(ep.number) || 1;
              matched = true;
              break outer;
            }
          }
        }
        // Film senaryosu: episodeId "film" olabilir veya tek sezon yapısı
        if (!matched && room.episodeId === "film") {
          const first = det.data.seasons?.[0]?.episodes ?? [];
          setSeasonEpisodes(first);
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

  useEffect(() => {
    let active = true;
    (async () => {
      setFriendsLoading(true);
      setFriendsError(null);
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(currentUser.username)}/friends`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (data.success) {
          setFriends(data.items ?? []);
        } else {
          setFriendsError(data.error ?? "Arkadaş listesi alınamadı.");
        }
      } catch {
        if (active) setFriendsError("Arkadaş listesi alınamadı.");
      } finally {
        if (active) setFriendsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser.username]);

  useEffect(() => {
    if (!memberReady) return;
    function onNotif(e: Event) {
      const detail = (e as CustomEvent).detail as Record<string, unknown>;
      if (!detail || detail.t !== "notification") return;
      const type = String(detail.type ?? "");
      if (type !== "invite" && type !== "room_request" && type !== "offline_invite") return;
      const p = (detail.payload ?? {}) as Record<string, unknown>;
      updateMiniInvite({
        id: String(detail.id ?? `${Date.now()}-${Math.random()}`),
        inviteId: p.inviteId ? String(p.inviteId) : undefined,
        roomId: p.roomId ? String(p.roomId) : undefined,
        inviteUrl: p.inviteUrl ? String(p.inviteUrl) : undefined,
        animeName: p.animeName ? String(p.animeName) : undefined,
        username: p.username ? String(p.username) : undefined,
        displayName: (p.displayName as string | null) ?? null,
      });
    }
    window.addEventListener("calium:notification", onNotif);
    return () => window.removeEventListener("calium:notification", onNotif);
  }, [memberReady, updateMiniInvite]);

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
          avatarUrl:
            m.userId === currentUser.id
              ? currentUser.avatarUrl
              : mem?.user.avatarUrl ?? host?.avatarUrl ?? null,
          text: m.text,
          ts: m.ts,
        },
      ]);
    },
    [currentUser.avatarUrl, currentUser.displayName, currentUser.id, currentUser.username, members, room.host, room.hostId]
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
          const sentAt = Date.now();
          // Biraz gecikme ile gönder (guest'in WS room.joined almasını bekle)
          setTimeout(() => {
            sendPlaybackRef.current?.("episode-change", {
              time,
              paused,
              sentAt,
              episodeId: room.episodeId,
              episodeName: room.episodeName,
            });
            sendPlaybackRef.current?.("sync", {
              time,
              paused,
              sentAt,
              episodeId: room.episodeId,
              episodeName: room.episodeName,
            });
            setTimeout(() => {
              if (paused) {
                sendPlaybackRef.current?.("pause", {
                  time,
                  paused: true,
                  sentAt: Date.now(),
                  episodeId: room.episodeId,
                  episodeName: room.episodeName,
                });
              } else {
                sendPlaybackRef.current?.("play", {
                  time,
                  paused: false,
                  sentAt: Date.now(),
                  episodeId: room.episodeId,
                  episodeName: room.episodeName,
                });
              }
            }, 250);
          }, 900);
        }
      }
    },
    [refreshRoom, room.episodeId, room.episodeName]
  );

  const [mutedByAutoplay, setMutedByAutoplay] = useState(false);

  const onPlayback = useCallback((e: PlaybackEvent) => {
    if (isHostRef.current) return; // host kendine uygulamaz
    const p = playerRef.current;
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

      if (typeof d.episodeId === "string" && d.episodeId) {
        const episodeName = typeof d.episodeName === "string" || d.episodeName === null ? d.episodeName : null;
        setRoom((r) => {
          if (r.episodeId === d.episodeId && r.episodeName === episodeName) return r;
          setPlayerReady(false);
          pendingPlaybackResumeRef.current = {
            time: typeof d.time === "number" ? d.time : (remoteClockRef.current?.time ?? 0),
            paused:
              typeof d.paused === "boolean"
                ? d.paused
                : remotePausedRef.current,
          };
          return { ...r, episodeId: d.episodeId!, episodeName };
        });
      }

      if (e.action === "play") {
        remotePausedRef.current = false;
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          if (p) p.currentTime = d.time;
        }
        if (!p) return;
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
        remotePausedRef.current = true;
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          if (p) p.currentTime = d.time;
        }
        if (!p) return;
        safePause(p);
      } else if (e.action === "seek") {
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          const drift = p ? Math.abs(p.currentTime - d.time) : 0;
          if (p && drift > 0.9) {
            p.currentTime = d.time;
          }
        }
      } else if (e.action === "sync") {
        if (typeof d.time === "number") {
          setRemoteClock(d.time);
          const drift = p ? Math.abs(p.currentTime - d.time) : 0;
          if (p && drift > 3) {
            p.currentTime = d.time;
          }
        }
        if (typeof d.paused === "boolean") {
          remotePausedRef.current = d.paused;
          if (!p) return;
          if (d.paused && !p.paused) safePause(p);
          if (!d.paused && p.paused) {
            safePlay(p);
          }
        }
      } else if (e.action === "episode-change") {
        if (typeof d.episodeId === "string" && d.episodeId) {
          const episodeName = typeof d.episodeName === "string" || d.episodeName === null ? d.episodeName : null;
          setRoom((r) => {
            if (r.episodeId === d.episodeId && r.episodeName === episodeName) return r;
            setPlayerReady(false);
            return { ...r, episodeId: d.episodeId!, episodeName };
          });
        }
        if (typeof d.time === "number") {
          pendingPlaybackResumeRef.current = {
            time: d.time,
            paused: typeof d.paused === "boolean" ? d.paused : false,
          };
        }
      }
    } finally {
      setTimeout(() => {
        suppressEventRef.current = false;
      }, 300);
    }
  }, []);

  const onUpdate = useCallback((u: { episodeId: string; episodeName: string | null; sentAt?: number }) => {
    const sentAt = typeof u.sentAt === "number" ? u.sentAt : Date.now();
    if (sentAt < lastEpisodeUpdateAtRef.current) return;
    lastEpisodeUpdateAtRef.current = sentAt;
    setPlayerReady(false);
    setRoom((r) => {
      if (r.episodeId === u.episodeId && r.episodeName === u.episodeName) return r;
      return { ...r, episodeId: u.episodeId, episodeName: u.episodeName };
    });
  }, []);

  const onKicked = useCallback(() => {
    showRoomAlert("Odadan çıkarıldın", "Oda erişimin sonlandırıldı ve arkadaşlar sayfasına yönlendirileceksin.");
    router.replace("/arkadaslar");
  }, [router, showRoomAlert]);

  const onClosed = useCallback(() => {
    showRoomAlert("Oda kapatıldı", "Host bu odayı kapattığı için oturum sonlandırıldı.");
    router.replace("/arkadaslar");
  }, [router, showRoomAlert]);

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
      sendPlayback("play", {
        time: p.currentTime,
        paused: false,
        sentAt: Date.now(),
        episodeId: room.episodeId,
        episodeName: room.episodeName,
      });
    });
    const offPause = p.listen("pause", () => {
      if (suppressEventRef.current) return;
      sendPlayback("pause", {
        time: p.currentTime,
        paused: true,
        sentAt: Date.now(),
        episodeId: room.episodeId,
        episodeName: room.episodeName,
      });
    });
    const offSeeked = p.listen("seeked", () => {
      if (suppressEventRef.current) return;
      sendPlayback("seek", {
        time: p.currentTime,
        paused: p.paused,
        sentAt: Date.now(),
        episodeId: room.episodeId,
        episodeName: room.episodeName,
      });
    });
    return () => {
      offPlay();
      offPause();
      offSeeked();
    };
  }, [playerReady, isHost, room.episodeId, room.episodeName, sendPlayback]);

  // Periyodik sync (host)
  useEffect(() => {
    if (!isHost || !ready || !playerReady) return;
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      sendPlayback("sync", {
        time: p.currentTime,
        paused: p.paused,
        sentAt: Date.now(),
        episodeId: room.episodeId,
        episodeName: room.episodeName,
      });
    }, 10_000);
    return () => clearInterval(iv);
  }, [isHost, ready, playerReady, room.episodeId, room.episodeName, sendPlayback]);

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
      if (drift > 3) {
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
        if (typeof target === "number" && Math.abs(p.currentTime - target) > 3) {
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

  async function toggleVisibility() {
    if (!isHost || visibilityBusy) return;
    setVisibilityBusy(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !room.isPublic }),
      });
      const data = await res.json();
      if (data.success) {
        setRoom((r) => ({ ...r, isPublic: !r.isPublic }));
      }
    } finally {
      setVisibilityBusy(false);
    }
  }

  async function leaveRoom() {
    if (isHost) {
      const ok = await confirm({
        title: "Odadan ayrıl",
        description: "Host olarak ayrılırsan oda kapanır. Devam etmek istiyor musun?",
        confirmText: "Ayrıl ve kapat",
        cancelText: "Vazgeç",
        variant: "danger",
      });
      if (!ok) return;
    }
    await fetch(`/api/rooms/${room.id}/leave`, { method: "POST" });
    router.replace("/arkadaslar");
  }

  useEffect(() => {
    if (!room.hostLeftAt || room.endedAt) return;
    const leftAt = new Date(room.hostLeftAt).getTime();
    const elapsed = Date.now() - leftAt;
    const remaining = 60_000 - elapsed;
    if (remaining <= 0) {
      router.replace("/arkadaslar?error=room_closed");
      return;
    }
    const timer = window.setTimeout(() => {
      router.replace("/arkadaslar?error=room_closed");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [room.hostLeftAt, room.endedAt, router, showRoomAlert]);

  async function kickUser(userId: string, ban = false) {
    const ok = await confirm({
      title: ban ? "Kullanıcıyı banla" : "Kullanıcıyı odadan çıkar",
      description: ban
        ? "Bu işlem kullanıcının odaya tekrar katılmasını engeller."
        : "Kullanıcı anında odadan çıkarılacak.",
      confirmText: ban ? "Banla" : "Çıkar",
      cancelText: "Vazgeç",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/rooms/${room.id}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ban }),
    });
    refreshRoom();
  }

  async function inviteUser(payload: { friendId?: string; username?: string }) {
    const res = await fetch(`/api/rooms/${room.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      if (data.invite?.inviteUrl) {
        setInviteLink(`${location.origin}${data.invite.inviteUrl}`);
      }
      showRoomAlert("Davet gönderildi", "Seçili kişiye oda daveti başarıyla iletildi.");
    } else {
      showRoomAlert("Davet gönderilemedi", data.error ?? "İşlem tamamlanamadı.");
    }
  }

  const currentEpisodeIndex = useMemo(() => seasonEpisodes.findIndex((e) => e.ID === room.episodeId), [seasonEpisodes, room.episodeId]);
  const prevEpisode = currentEpisodeIndex > 0 ? seasonEpisodes[currentEpisodeIndex - 1] : null;
  const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentEpisodeIndex + 1] : null;

  async function changeEpisode(ep: EpisodeData) {
    if (!isHost) return;
    const res = await fetch(`/api/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeId: ep.ID, episodeName: ep.name ?? null }),
    });
    const data = await res.json();
    if (data.success) {
      const p = playerRef.current;
      const sentAt = Date.now();
      const playbackState = p
        ? { time: p.currentTime, paused: p.paused, sentAt, episodeId: ep.ID, episodeName: ep.name ?? null }
        : { time: 0, paused: true, sentAt, episodeId: ep.ID, episodeName: ep.name ?? null };
      pendingPlaybackResumeRef.current = playbackState;
      sendPlaybackRef.current?.("episode-change", playbackState);
      sendPlaybackRef.current?.("sync", playbackState);
      lastEpisodeUpdateAtRef.current = sentAt;
      setPlayerReady(false);
      setRoom((r) => ({ ...r, episodeId: ep.ID, episodeName: ep.name ?? null }));
    }
  }

  async function respondMiniInvite(action: "accept" | "decline") {
    if (!miniInvite) return;
    const current = miniInvite;
    updateMiniInvite(null);
    if (!current.inviteId) {
      if (action === "accept" && current.inviteUrl) window.location.href = current.inviteUrl;
      return;
    }
    const res = await fetch("/api/rooms/invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: current.inviteId, action }),
    });
    const data = await res.json();
    if (action === "accept" && data.success && data.room?.id) {
      window.location.href = `/oda/${data.room.id}?code=${encodeURIComponent(data.room.code ?? "")}`;
    }
  }

  const chatOverlayLines = useMemo(() => {
    const visibleIds = new Set(visibleOverlayLineIds);
    return lines.filter((l) => !l.system && visibleIds.has(l.id)).slice(-5);
  }, [lines, visibleOverlayLineIds]);
  const overlayLineExitIdSet = useMemo(() => new Set(overlayLineExitIds), [overlayLineExitIds]);
  const handleControlsVisibilityChange = useCallback((visible: boolean) => {
    setPlayerControlsVisible(visible);
  }, []);

  const roomAlertNode = roomAlert.open ? (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-[min(92vw,460px)] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{roomAlert.title}</h2>
            {roomAlert.description ? (
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">{roomAlert.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setRoomAlert((prev) => ({ ...prev, open: false }))}
            className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setRoomAlert((prev) => ({ ...prev, open: false }))}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const overlayTopRight = isFullscreen && playerControlsVisible ? (
    <div className="flex items-start justify-start gap-2 md:justify-end">
      <button
        type="button"
        onClick={() => setChatOverlayEnabled((v) => !v)}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-white/30 bg-black/55 px-3 text-xs text-white backdrop-blur"
      >
        <MessageSquare className="h-3.5 w-3.5" /> {chatOverlayEnabled ? "Balonlar açık" : "Balonlar kapalı"}
      </button>
    </div>
  ) : null;

  const overlayPersistentTopRight = isFullscreen && miniInvite ? (
    miniInviteCollapsed ? (
      <button
        type="button"
        aria-label="Davet"
        onClick={() => setMiniInviteCollapsed(false)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white"
      >
        <UserPlus className="h-4 w-4" />
      </button>
    ) : (
      <div className="animate-room-chat-float w-[min(88vw,320px)] rounded-xl border border-white/25 bg-black/70 p-2.5 text-white backdrop-blur">
        <div className="text-xs font-semibold">Birlikte izleme daveti</div>
        <p className="mt-1 text-[11px] text-white/90">
          {(miniInvite.displayName || miniInvite.username || "Biri")} seni {miniInvite.animeName || "bir odaya"} davet ediyor.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => void respondMiniInvite("accept")} className="flex-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]">
            Kabul
          </button>
          <button type="button" onClick={() => void respondMiniInvite("decline")} className="rounded-full border border-white/30 px-3 py-1.5 text-xs">
            Reddet
          </button>
          <button type="button" onClick={() => updateMiniInvite(null)} className="rounded-full border border-white/30 p-1.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  ) : null;

  const overlayRightRail = isFullscreen && chatOverlayEnabled && chatOverlayLines.length > 0 ? (
    <div className="flex h-full flex-col justify-end gap-2 pr-1">
      {chatOverlayLines.map((l) => (
        <div
          key={l.id}
          className={cn(
            "ml-auto flex max-w-[95%] items-end gap-2 rounded-2xl bg-black/60 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-sm",
            overlayLineExitIdSet.has(l.id) ? "animate-room-chat-fade-out" : "animate-room-chat-float"
          )}
        >
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/10">
            {l.avatarUrl ? (
              <Image src={l.avatarUrl} alt={l.username} width={32} height={32} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/80">
                {(l.displayName || l.username).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white/85">{l.displayName || l.username}</p>
            <p className="break-words">{l.text}</p>
          </div>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-clip px-3 py-3 sm:px-6 sm:py-4">
      {roomAlertNode}
      {/* Üst bar */}
      <div className="mb-3 space-y-2">
        <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/anime/${encodeURIComponent(room.animeId)}`}
          className="min-w-0 max-w-full shrink text-xs sm:text-sm inline-flex items-center gap-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{room.animeName}</span>
        </Link>
        {isHost ? (
          <button
            type="button"
            onClick={() => void toggleVisibility()}
            disabled={visibilityBusy}
            aria-label={room.isPublic ? "Özel yap" : "Açık yap"}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] sm:px-3 sm:text-xs hover:bg-[var(--muted)] disabled:opacity-60"
          >
            {visibilityBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : room.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {room.isPublic ? "Açık oda" : "Özel oda"}
          </button>
        ) : (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] sm:px-3 sm:text-xs">
            {room.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {room.isPublic ? "Açık oda" : "Özel oda"}
          </span>
        )}
        </div>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => void copyText(room.code, "code")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs hover:bg-[var(--muted)]"
        >
          <Copy className="h-3 w-3" /> {copied && copiedWhat === "code" ? "Kod kopyalandı!" : `Kod: ${room.code}`}
        </button>
        <button
          type="button"
          onClick={() => void generateInviteLink()}
          disabled={inviteBusy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs hover:bg-[var(--muted)] disabled:opacity-60"
        >
          {inviteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
          {copied && copiedWhat === "link" ? "Bağlantı kopyalandı!" : "Davet linki"}
        </button>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs hover:bg-[var(--muted)]"
        >
          <UserPlus className="h-3 w-3" /> Davet et
        </button>
        <button
          type="button"
          onClick={leaveRoom}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] sm:px-3 sm:text-xs text-red-500 hover:bg-red-500/15"
        >
          {isHost ? <DoorOpen className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
          {isHost ? "Odayı kapat" : "Ayrıl"}
        </button>
        </div>
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
          friends={friends}
          friendsLoading={friendsLoading}
          friendsError={friendsError}
        />
      )}

      <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Oynatıcı */}
        <div className="min-w-0 max-w-full">
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
            <div className={cn("relative min-w-0 max-w-full") }>
              <AnimePlayer
                groups={sources.groups}
                subtitles={sources.subtitles}
                poster={room.poster}
                title={`${room.animeName}${room.episodeName ? ` — ${room.episodeName}` : ""}`}
                introStart={parseTimeCode(sources.content?.opening?.start)}
                introEnd={parseTimeCode(sources.content?.opening?.end)}
                onNextEpisode={() => {
                  if (!nextEpisode) return;
                  void changeEpisode(nextEpisode);
                }}
                overlayTopRight={overlayTopRight}
                overlayPersistentTopRight={overlayPersistentTopRight}
                overlayRightRail={overlayRightRail}
                onFullscreenChange={(v) => setIsFullscreen(v)}
                onControlsVisibilityChange={handleControlsVisibilityChange}
                onPlayerReady={(p) => {
                  playerRef.current = p;
                  setPlayerReady(true);
                  const pending = pendingPlaybackResumeRef.current;
                  if (pending) {
                    remoteClockRef.current = { time: pending.time, sentAt: Date.now() };
                    remotePausedRef.current = pending.paused;
                    try {
                      p.currentTime = pending.time;
                    } catch {}
                    if (pending.paused) {
                      safePause(p);
                    } else {
                      safePlay(p);
                    }
                    pendingPlaybackResumeRef.current = null;
                  } else if (!isHostRef.current) {
                    const clock = remoteClockRef.current;
                    if (clock) {
                      const target = clock.time + Math.max(0, (Date.now() - clock.sentAt) / 1000);
                      try {
                        p.currentTime = target;
                      } catch {}
                    }
                    if (remotePausedRef.current) {
                      safePause(p);
                    } else {
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
                    }
                  }
                }}
              />
              {isHost && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!prevEpisode}
                    onClick={() => prevEpisode && void changeEpisode(prevEpisode)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Önceki
                  </button>
                  <button
                    type="button"
                    disabled={!nextEpisode}
                    onClick={() => nextEpisode && void changeEpisode(nextEpisode)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-50"
                  >
                    Sonraki <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEpisodePicker(true)}
                    className="inline-flex min-w-0 max-w-full flex-1 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs sm:flex-none"
                  >
                    <Play className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{room.episodeName || `Bölüm ${seasonEpisodes[currentEpisodeIndex]?.number ?? "?"}`}</span>
                  </button>
                  </div>
                  {showEpisodePicker && (
                    <EpisodePickerPanel
                      episodes={seasonEpisodes}
                      activeEpisodeId={room.episodeId}
                      onSelect={(ep) => {
                        void changeEpisode(ep);
                        setShowEpisodePicker(false);
                      }}
                      onClose={() => setShowEpisodePicker(false)}
                    />
                  )}
                </div>
              )}
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

          <div className="mt-3 sm:mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 sm:p-3">
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
                    <div className="relative h-9 w-9 shrink-0 overflow-visible">
                      <div className="h-full w-full overflow-hidden rounded-full bg-[var(--muted)]">
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
                      </div>
                      <PresenceDot
                        status={status}
                        className="absolute -bottom-1 -right-1 z-10"
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
        <aside className="min-w-0 max-w-full h-[52dvh] min-h-[300px] max-h-[520px] lg:h-auto lg:max-h-[800px]">
          <RoomChat
            lines={lines}
            onSend={sendChat}
            currentUserId={currentUser.id}
            onSent={() => {
              const p = playerRef.current;
              const el = p?.el;
              if (el) {
                window.setTimeout(() => {
                  try {
                    el.focus();
                  } catch {}
                }, 0);
              }
            }}
          />
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
  friends,
  friendsLoading,
  friendsError,
}: {
  inviteCode: string;
  inviteLink: string | null;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onSend: (payload: { friendId?: string; username?: string }) => void;
  onClose: () => void;
  friends: FriendItem[];
  friendsLoading: boolean;
  friendsError: string | null;
}) {
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [query, setQuery] = useState("");
  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) =>
      (f.displayName || "").toLowerCase().includes(q) || f.username.toLowerCase().includes(q)
    );
  }, [friends, query]);
  return (
    <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 sm:p-3">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">Arkadaş seçerek davet</p>
          {friendsError ? <p className="text-xs text-red-500">{friendsError}</p> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Arkadaş ara..."
              className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {friendsLoading ? (
              <p className="text-xs text-[var(--muted-foreground)]">Yükleniyor...</p>
            ) : filteredFriends.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">Arkadaş bulunamadı.</p>
            ) : (
              filteredFriends.map((f) => {
                const selected = selectedFriendId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFriendId(f.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary)]/10"
                        : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]"
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)] text-xs font-bold text-[var(--muted-foreground)]">
                      {f.avatarUrl ? (
                        <Image src={f.avatarUrl} alt={f.username} width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        (f.displayName || f.username).slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.displayName || f.username}</p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">@{f.username}</p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-[var(--primary)]" />}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!selectedFriendId}
              onClick={() => {
                if (selectedFriendId) onSend({ friendId: selectedFriendId });
              }}
              className="h-9 rounded-full bg-[var(--primary)] px-4 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              Davet Gönder
            </button>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <p className="font-medium text-[var(--muted-foreground)]">Kod veya bağlantı ile katılım</p>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span className="truncate font-semibold tracking-[0.16em]">{inviteCode}</span>
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

function EpisodePickerPanel({
  episodes,
  activeEpisodeId,
  onSelect,
  onClose,
}: {
  episodes: EpisodeData[];
  activeEpisodeId: string;
  onSelect: (ep: EpisodeData) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((ep) =>
      ep.name.toLowerCase().includes(q) || String(ep.number ?? "").toLowerCase().includes(q)
    );
  }, [episodes, query]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/96 p-3 shadow-lg backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Bölüm Seç</h3>
          <p className="text-xs text-[var(--muted-foreground)]">İzlemek istediğin bölümü seç.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-[var(--border)] p-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Bölüm ara..."
          className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {filtered.map((ep) => {
          const active = ep.ID === activeEpisodeId;
          return (
            <li key={ep.ID}>
              <button
                type="button"
                onClick={() => onSelect(ep)}
                className={cn(
                  "group flex w-full gap-3 rounded-xl border bg-[var(--card)] p-2 text-left transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--muted)]"
                )}
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)] sm:h-20 sm:w-36">
                  {ep.banner_link ? (
                    <Image src={ep.banner_link} alt={ep.name} fill sizes="144px" className="object-cover transition group-hover:scale-105" />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <Play className="h-6 w-6 fill-white text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <p className="text-xs text-[var(--muted-foreground)]">Bölüm {ep.number ?? "-"}</p>
                  <h4 className="line-clamp-1 text-sm font-semibold">{ep.name}</h4>
                  {ep.overview ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">{ep.overview}</p> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
