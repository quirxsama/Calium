"use client";
import { useState, useTransition } from "react";
import { UserPlus, UserCheck, UserMinus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type FollowStatus = "not_following" | "following" | "requested" | "self";

type Props = {
  username: string;
  initialStatus: FollowStatus;
  /** Hedef hesap gizli mi? Sadece ilk takip butonunun metnini/ikonunu etkiler. */
  isPrivate?: boolean;
  /** Durum değiştiğinde parent'a haber ver (sayılar güncellensin diye). */
  onChange?: (status: FollowStatus) => void;
  className?: string;
};

export function FollowButton({ username, initialStatus, isPrivate, onChange, className }: Props) {
  const [status, setStatus] = useState<FollowStatus>(initialStatus);
  const [pending, start] = useTransition();

  if (status === "self") return null;

  async function toggle() {
    const wantFollow = status === "not_following";
    const method = wantFollow ? "POST" : "DELETE";
    start(async () => {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method });
      const json = await res.json();
      if (res.ok && json.success) {
        const next: FollowStatus = json.status ?? (wantFollow ? "following" : "not_following");
        setStatus(next);
        onChange?.(next);
      }
    });
  }

  const config = {
    not_following: {
      label: isPrivate ? "İstek Gönder" : "Takip Et",
      icon: UserPlus,
      classes: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
    },
    requested: {
      label: "İstek Gönderildi",
      icon: Clock,
      classes: "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/70",
    },
    following: {
      label: "Takip Ediliyor",
      icon: UserCheck,
      classes: "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-red-500/50 hover:text-red-500",
    },
    self: { label: "", icon: UserPlus, classes: "" },
  }[status];

  const Icon = config.icon;
  const hoverLabel = status === "following" ? "Takipten Çık" : status === "requested" ? "İsteği İptal Et" : config.label;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "group inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60",
        config.classes,
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="group-hover:hidden">{config.label}</span>
      <span className="hidden group-hover:inline">{hoverLabel}</span>
      {status === "following" && <UserMinus className="h-4 w-4 hidden group-hover:inline" />}
    </button>
  );
}
