"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Loader2, KeyRound, Mail, Trash2, AlertTriangle, Shield, BellOff, Lock, Users } from "lucide-react";

export function AccountTab() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Hesap</h2>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">Şifre, email değişikliği ve hesap silme işlemleri.</p>
      </div>

      <PrivacySection />
      <ChangePasswordSection />
      <ChangeEmailSection email={user?.email ?? ""} />
      <DeleteAccountSection
        onDeleted={async () => {
          await logout();
          router.push("/");
        }}
      />
    </div>
  );
}

function PrivacySection() {
  const { user, refresh } = useAuth();
  const [isPrivate, setIsPrivate] = useState<boolean>(!!user?.isPrivate);
  const [dnd, setDnd] = useState<boolean>(!!user?.dndEnabled);
  const [offlineInvites, setOfflineInvites] = useState<boolean>(!!user?.allowOfflineInvites);
  const [savingKey, setSavingKey] = useState<"isPrivate" | "dndEnabled" | "allowOfflineInvites" | null>(null);

  async function save(key: "isPrivate" | "dndEnabled" | "allowOfflineInvites", value: boolean) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!data.success) {
        // rollback
        if (key === "isPrivate") setIsPrivate(!value);
        else if (key === "dndEnabled") setDnd(!value);
        else if (key === "allowOfflineInvites") setOfflineInvites(!value);
      } else {
        refresh?.();
      }
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Section icon={<Shield className="h-5 w-5" />} title="Gizlilik ve Bildirimler">
      <Toggle
        icon={<Lock className="h-4 w-4" />}
        label="Özel Profil"
        description="Açıkken profilini ve içeriklerini sadece onayladığın takipçiler görebilir. Takip istekleri gerekir."
        value={isPrivate}
        loading={savingKey === "isPrivate"}
        onChange={(v) => {
          setIsPrivate(v);
          save("isPrivate", v);
        }}
      />
      <div className="my-4 border-t border-[var(--border)]" />
      <Toggle
        icon={<BellOff className="h-4 w-4" />}
        label="Rahatsız Etmeyin (DND)"
        description="Açıkken davet pop-up'ları ve bildirim sesleri gösterilmez. Bildirimler bildirim merkezinde yine listelenir."
        value={dnd}
        loading={savingKey === "dndEnabled"}
        onChange={(v) => {
          setDnd(v);
          save("dndEnabled", v);
        }}
      />
      <div className="my-4 border-t border-[var(--border)]" />
      <Toggle
        icon={<Users className="h-4 w-4" />}
        label="Çevrimdışı Davetler"
        description="Siz bir oda açmasanız bile arkadaşlarınız size katılma isteği gönderebilir. Kabul ederseniz otomatik oda oluşur."
        value={offlineInvites}
        loading={savingKey === "allowOfflineInvites"}
        onChange={(v) => {
          setOfflineInvites(v);
          save("allowOfflineInvites", v);
        }}
      />
    </Section>
  );
}

function Toggle({
  icon,
  label,
  description,
  value,
  loading,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  loading?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[var(--muted-foreground)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={loading}
        role="switch"
        aria-checked={value}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--border)] transition disabled:opacity-50 ${
          value ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setMessage({ type: "success", text: "Şifre değiştirildi." });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setMessage({ type: "error", text: data.error ?? "Bir hata oluştu." });
    }
  }

  return (
    <Section icon={<KeyRound className="h-5 w-5" />} title="Şifre Değiştir">
      {message && <Msg {...message} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          placeholder="Mevcut şifre"
          autoComplete="current-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Yeni şifre (en az 6 karakter)"
          autoComplete="new-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Değiştir
        </button>
      </form>
    </Section>
  );
}

function ChangeEmailSection({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/account/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, newEmail }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setMessage({ type: "success", text: "Email değiştirildi." });
      setPassword("");
      setNewEmail("");
    } else {
      setMessage({ type: "error", text: data.error ?? "Bir hata oluştu." });
    }
  }

  return (
    <Section icon={<Mail className="h-5 w-5" />} title="Email Değiştir">
      <p className="mb-3 text-xs text-[var(--muted-foreground)]">Mevcut: {email}</p>
      {message && <Msg {...message} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          placeholder="Yeni email adresi"
          autoComplete="email"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Mevcut şifrenizi girin"
          autoComplete="current-password"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Değiştir
        </button>
      </form>
    </Section>
  );
}

function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      onDeleted();
    } else {
      setError(data.error ?? "Bir hata oluştu.");
    }
  }

  return (
    <Section icon={<Trash2 className="h-5 w-5 text-red-400" />} title="Hesabı Sil" danger>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">
        Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinir.
      </p>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
        >
          <AlertTriangle className="h-4 w-4" />
          Hesabımı Sil
        </button>
      ) : (
        <div className="space-y-3">
          {error && <Msg type="error" text={error} />}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifrenizi onaylayın"
            autoComplete="current-password"
            className="w-full rounded-xl border border-red-500/30 bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-red-500/30"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={loading || !password}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Evet, Sil
            </button>
            <button
              onClick={() => {
                setConfirm(false);
                setPassword("");
                setError("");
              }}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function Section({
  icon,
  title,
  danger,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${danger ? "border-red-500/20 bg-red-500/5" : "border-[var(--border)] bg-[var(--card)]"}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className={danger ? "text-red-400" : "text-[var(--primary)]"}>{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Msg({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div className={`mb-3 rounded-lg border px-4 py-2.5 text-sm ${type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
      {text}
    </div>
  );
}
