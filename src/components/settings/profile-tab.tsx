"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { Loader2, Save, Eye, EyeOff, Upload } from "lucide-react";

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

        <Field label="Avatar URL" htmlFor="avatarUrl">
          <div className="space-y-2">
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            >
              <Upload className="h-4 w-4" />
              Cihazdan yükle
            </button>
            <p className="text-xs text-[var(--muted-foreground)]">Maksimum 5MB. Yüklenen görsel, profil avatarı olarak kaydedilir.</p>
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
