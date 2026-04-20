"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Loader2, KeyRound, Mail, Trash2, AlertTriangle } from "lucide-react";

export function AccountTab() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Hesap</h2>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">Şifre, email değişikliği ve hesap silme işlemleri.</p>
      </div>

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
