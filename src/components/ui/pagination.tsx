import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  basePath,
  page,
  totalPages,
  extraParams,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  extraParams?: Record<string, string | undefined>;
}) {
  if (!totalPages || totalPages <= 1) return null;
  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const pages: (number | "…")[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  if (start > 1) pages.push(1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("…");
  if (end < totalPages) pages.push(totalPages);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5 text-sm">
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
          aria-label="Önceki"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-2 text-[var(--muted-foreground)]">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 border transition ${
              p === page
                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
            }`}
          >
            {p}
          </Link>
        )
      )}
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
          aria-label="Sonraki"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
