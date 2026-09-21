"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { LogIn, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      router.push("/");
    } else {
      setError(result.error || "Giriş başarısız.");
    }
  }

  async function handleOAuth(provider: "anilist" | "mal") {
    setError("");
    setLoading(true);
    try {
      const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
      const random = new Uint8Array(43);
      crypto.getRandomValues(random);
      const verifier = Array.from(random, (byte) => charset[byte % charset.length]).join("");
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const startRes = await fetch(`/api/auth/oauth/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "login", platform: "web", challenge }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || "Giriş başlatılamadı");
      }
      const { authorizationUrl, transactionId } = await startRes.json();
      const popup = window.open(authorizationUrl, "_blank", "width=600,height=750");

      let loggedIn = false;
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const exRes = await fetch("/api/auth/oauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId, verifier }),
        });
        if (exRes.status === 200) {
          const data = await exRes.json();
          if (data.pending) continue;
          if (data.success) {
            loggedIn = true;
            popup?.close();
            window.location.href = "/";
            break;
          }
        } else if (exRes.status >= 400 && exRes.status !== 404) {
          const err = await exRes.json().catch(() => ({}));
          throw new Error(err.error || "Yetkilendirme başarısız");
        }
      }
      if (!loggedIn) throw new Error("Giriş zaman aşımına uğradı");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-xl shadow-black/10">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/20">
              <LogIn className="h-7 w-7 text-[var(--primary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Giriş Yap</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Hesabınıza giriş yaparak devam edin
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
                placeholder="ornek@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 pr-11 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Giriş Yap
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">VEYA</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuth("anilist")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#02A9FF]/40 bg-[#02A9FF]/10 py-2.5 text-sm font-semibold text-[#02A9FF] transition hover:bg-[#02A9FF]/20 disabled:opacity-50"
            >
              AniList ile Giriş Yap
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuth("mal")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2E51A2]/40 bg-[#2E51A2]/10 py-2.5 text-sm font-semibold text-[#688ee4] transition hover:bg-[#2E51A2]/20 disabled:opacity-50"
            >
              MyAnimeList ile Giriş Yap
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            Hesabınız yok mu?{" "}
            <Link href="/kayit" className="font-medium text-[var(--primary)] hover:underline">
              Kayıt olun
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
