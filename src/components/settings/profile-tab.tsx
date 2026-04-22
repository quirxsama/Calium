"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth/context";
import { Loader2, Save, Eye, EyeOff, Upload, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

export function ProfileTab() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [profilePublic, setProfilePublic] = useState(user?.profilePublic ?? true);
  const [listsPublic, setListsPublic] = useState(user?.listsPublic ?? true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarPresets, setAvatarPresets] = useState<{ ID: string; name: string; link: string | null }[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [presetSource, setPresetSource] = useState<string | null>(null);
  const presetsScrollRef = useRef<HTMLDivElement | null>(null);

  const [animeQuery, setAnimeQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; poster: string | null }[]>([]);
  const [searchCommittedQuery, setSearchCommittedQuery] = useState("");
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/avatar-presets")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.avatars)) {
          setAvatarPresets(data.avatars);
          setPresetSource(data.source ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setAvatarPresets([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPresets(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = animeQuery.trim();
    if (!q || q.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/anime/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data.success && Array.isArray(data.results)) {
            setSearchResults(data.results);
            setSearchCommittedQuery(q);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
            setSearchCommittedQuery(q);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [animeQuery]);

  const searching = animeQuery.trim().length >= 2 && animeQuery.trim() !== searchCommittedQuery;

  useEffect(() => {
    if (animeQuery.trim().length >= 2) return;
    if (searchResults.length === 0 && searchCommittedQuery === "") return;

    queueMicrotask(() => {
      setSearchResults([]);
      setSearchCommittedQuery("");
    });
  }, [animeQuery, searchCommittedQuery, searchResults.length]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function selectAnimeForAvatars(id: string, name: string) {
    setAnimeQuery("");
    setSearchResults([]);
    setSearchCommittedQuery("");
    setPresetSource(name);
    setLoadingPresets(true);
    try {
      const res = await fetch(`/api/avatar-presets?animeId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.avatars)) {
        setAvatarPresets(data.avatars);
      }
    } catch {
      setAvatarPresets([]);
    } finally {
      setLoadingPresets(false);
    }
  }

  function resetToPopular() {
    setPresetSource(null);
    setAnimeQuery("");
    setSearchResults([]);
    setSearchCommittedQuery("");
    setLoadingPresets(true);
    fetch("/api/avatar-presets")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.avatars)) {
          setAvatarPresets(data.avatars);
          setPresetSource(data.source ?? null);
        }
      })
      .catch(() => setAvatarPresets([]))
      .finally(() => setLoadingPresets(false));
  }

  async function handleAvatarFile(file: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Avatar boyutu en fazla 5MB olabilir." });
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
      reader.readAsDataURL(file);
    });

    setAvatarUrl(dataUrl);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, bio, avatarUrl, profilePublic, listsPublic }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      updateUser(data.user);
      setMessage({ type: "success", text: "Profil güncellendi." });
    } else {
      setMessage({ type: "error", text: data.error ?? "Bir hata oluştu." });
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Profil</h2>
      <p className="mb-6 text-sm text-[var(--muted-foreground)]">Profil bilgilerinizi ve görünürlük ayarlarınızı düzenleyin.</p>

      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${message.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        <Field label="Görünen Ad" htmlFor="displayName">
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
            placeholder={user?.username}
          />
        </Field>

        <Field label="Hakkımda" htmlFor="bio">
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
            placeholder="Kendinizden bahsedin…"
          />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{bio.length}/500</p>
        </Field>

        <Field label="Avatar" htmlFor="avatarUrl">
          <div className="space-y-3">
            {avatarUrl && (
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[var(--border)]">
                  <Image src={avatarUrl} alt="Avatar" fill sizes="64px" className="object-cover" />
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">Mevcut avatar</span>
              </div>
            )}

            <input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
              placeholder="https://example.com/avatar.jpg"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleAvatarFile(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                <Upload className="h-4 w-4" />
                Cihazdan yükle
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Kaldır
                </button>
              )}
            </div>

            <div ref={searchWrapRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={animeQuery}
                  onChange={(e) => setAnimeQuery(e.target.value)}
                  placeholder="Anime ara ve karakter avatarı seç…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
                />
                {animeQuery && (
                  <button
                    type="button"
                    onClick={() => { setAnimeQuery(""); setSearchResults([]); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {searching && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Aranıyor…
                  </div>
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg">
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectAnimeForAvatars(r.id, r.name)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[var(--muted)]"
                    >
                      <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-[var(--muted)]">
                        {r.poster ? (
                          <Image src={r.poster} alt={r.name} fill sizes="40px" className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted-foreground)]">?</div>
                        )}
                      </div>
                      <span className="text-sm text-[var(--foreground)]">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingPresets && (
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                {presetSource ? `"${presetSource}" karakterleri yükleniyor…` : "Hazır avatarlar yükleniyor…"}
              </div>
            )}

            {!loadingPresets && avatarPresets.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    {presetSource ? `"${presetSource}" karakterleri` : "Popüler avatarlar"}
                  </p>
                  {presetSource && (
                    <button
                      type="button"
                      onClick={resetToPopular}
                      className="text-[10px] text-[var(--primary)] transition hover:underline"
                    >
                      Popülerlere dön
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      presetsScrollRef.current?.scrollBy({ left: -128, behavior: "smooth" });
                    }}
                    className="hidden shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] md:inline-flex"
                    aria-label="Önceki avatarlar"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div
                    ref={presetsScrollRef}
                    className="flex gap-2.5 overflow-x-auto pb-2"
                  >
                    {avatarPresets.map((preset) =>
                      preset.link ? (
                        <button
                          key={preset.ID}
                          type="button"
                          onClick={() => setAvatarUrl(preset.link!)}
                          title={preset.name}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 transition ${
                            avatarUrl === preset.link
                              ? "border-[var(--primary)]"
                              : "border-[var(--border)] hover:border-[var(--primary)]/50"
                          }`}
                        >
                          <Image
                            src={preset.link}
                            alt={preset.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </button>
                      ) : null
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      presetsScrollRef.current?.scrollBy({ left: 128, behavior: "smooth" });
                    }}
                    className="hidden shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] md:inline-flex"
                    aria-label="Sonraki avatarlar"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Field>

        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">Gizlilik</h3>
          <Toggle
            checked={profilePublic}
            onChange={setProfilePublic}
            label="Profil herkese açık"
            description="Kapatırsanız profiliniz sadece size görünür."
            iconOn={<Eye className="h-4 w-4" />}
            iconOff={<EyeOff className="h-4 w-4" />}
          />
          <Toggle
            checked={listsPublic}
            onChange={setListsPublic}
            label="Listeler herkese açık"
            description="Kapatırsanız listeleriniz sadece size görünür."
            iconOn={<Eye className="h-4 w-4" />}
            iconOff={<EyeOff className="h-4 w-4" />}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </button>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  iconOn,
  iconOff,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition hover:bg-[var(--muted)]"
    >
      <div className={`mt-0.5 ${checked ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
        {checked ? iconOn : iconOff}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
      </div>
      <div
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-[var(--primary)]" : "bg-[var(--muted)]"}`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </div>
    </button>
  );
}
