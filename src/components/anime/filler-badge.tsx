import { BadgeAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const FILLER_DESCRIPTION =
  "Filler bölüm, animenin veya dizinin ana hikaye akışına etki etmeyen, genellikle orijinal kaynakta (manga/kitap) bulunmayan ve yayın süresini doldurmak için eklenen gereksiz/bağımsız bölümlerdir.";

export function FillerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "group/filler relative inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300",
        className
      )}
      title={FILLER_DESCRIPTION}
    >
      <BadgeAlert className="h-3 w-3" aria-hidden="true" />
      Filler
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--popover)] px-3 py-2 text-left text-[11px] font-medium normal-case leading-5 tracking-normal text-[var(--popover-foreground)] opacity-0 shadow-xl transition-opacity duration-150 group-hover/filler:opacity-100">
        {FILLER_DESCRIPTION}
      </span>
    </span>
  );
}
