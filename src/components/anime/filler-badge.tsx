import { BadgeAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function FillerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300",
        className
      )}
      title="Filler bölüm"
    >
      <BadgeAlert className="h-3 w-3" aria-hidden="true" />
      Filler
    </span>
  );
}
