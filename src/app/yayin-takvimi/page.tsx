import Link from "next/link";
import { AniziumImage } from "@/components/anime/anizium-image";
import type { Metadata } from "next";
import { CalendarDays, Clock3, Clapperboard, Radio, Sparkles } from "lucide-react";
import { getCalendar } from "@/lib/anizium/endpoints";
import { buildBreadcrumbJsonLd, SITE_NAME } from "@/lib/seo";
import type { CalendarContent, CalendarDay } from "@/lib/anizium/schemas";
import { isCalendarEpisode } from "@/lib/anizium/calendar";

export const revalidate = 900;

const TIME_ZONE = "Europe/Istanbul";

export const metadata: Metadata = {
  title: `Yayın takvimi | ${SITE_NAME}`,
  description:
    "Anime yayın takviminde hangi gün hangi animenin yeni bölümünün geleceğini ve yaklaşan içerikleri takip et.",
  alternates: {
    canonical: "/yayin-takvimi",
  },
};

function toDate(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
}

function startOfTodayInIstanbul() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Date(`${parts}T00:00:00+03:00`);
}

function getDayDiff(date: Date) {
  const today = startOfTodayInIstanbul();
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
}

function formatRelativeDay(date: Date) {
  const diff = getDayDiff(date);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff > 1) return `${diff} gün sonra`;
  if (diff === -1) return "Dün";
  return `${Math.abs(diff)} gün önce`;
}

function getEpisodeText(item: CalendarContent) {
  if (!isCalendarEpisode(item)) return "Yaklaşan içerik";
  const parts = [];
  if (item.season) parts.push(`${item.season}. sezon`);
  if (item.episode) parts.push(`${item.episode}. bölüm`);
  return parts.length > 0 ? parts.join(" · ") : "Yeni bölüm";
}

function getCategoryText(item: CalendarContent) {
  if (isCalendarEpisode(item)) return "Sezonluk anime";
  if (item.category.includes("upcoming_4k")) return "Yaklaşan 4K";
  return "Takvim";
}

function sortContents(contents: CalendarContent[]) {
  return [...contents].sort((a, b) => {
    if (a.on_air !== b.on_air) return a.on_air ? -1 : 1;
    return a.content.name.localeCompare(b.content.name, "tr");
  });
}

function filterActiveDays(days: CalendarDay[]) {
  const today = startOfTodayInIstanbul().getTime();

  return days
    .map((day) => ({
      ...day,
      contents: sortContents(
        day.contents.filter((item) => {
          const date = toDate(item.release_date);
          return item.active && Boolean(date && date.getTime() >= today);
        })
      ),
    }))
    .filter((day) => day.contents.length > 0);
}

function CalendarCard({ item }: { item: CalendarContent }) {
  const date = toDate(item.release_date);
  const poster = item.content.poster ?? item.content.details_banner ?? item.content.banner ?? null;
  const animeId = item.content_id ?? item.ID;

  return (
    <Link
      href={`/anime/${encodeURIComponent(animeId)}`}
      className="group grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--primary)]/60 hover:shadow-xl hover:shadow-[var(--primary)]/10"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--muted)]">
        {poster ? (
          <AniziumImage
            src={poster}
            alt={item.content.name}
            fill
            sizes="72px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-[var(--muted-foreground)]">
            Poster yok
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
            {getCategoryText(item)}
          </span>
          {item.revise && (
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
              Revize
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-tight transition group-hover:text-[var(--primary)]">
          {item.content.name}
        </h3>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{getEpisodeText(item)}</p>
        {date && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            <Clock3 className="h-3.5 w-3.5" />
            {formatRelativeDay(date)}
          </p>
        )}
      </div>
    </Link>
  );
}

function DaySection({ day }: { day: CalendarDay }) {
  const firstDate = day.contents[0] ? toDate(day.contents[0].release_date) : null;
  const title = firstDate ? formatDate(firstDate) : `${day.day_name ?? "Gün"} · ${day.title}`;
  const subtitle = firstDate ? formatRelativeDay(firstDate) : day.month_name ?? "Takvim";
  const airingCount = day.contents.filter((item) => isCalendarEpisode(item)).length;

  return (
    <section className="scroll-mt-24" id={day.id}>
      <div className="mb-4 flex flex-col gap-2 rounded-3xl border border-[var(--border)] bg-[var(--card)]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">{subtitle}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1">
            <Clapperboard className="h-3.5 w-3.5" />
            {day.contents.length} içerik
          </span>
          {airingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-1 text-[var(--primary)]">
              <Radio className="h-3.5 w-3.5" />
              {airingCount} yeni bölüm
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {day.contents.map((item) => (
          <CalendarCard key={item._id ?? `${day.id}-${item.ID}-${item.season}-${item.episode}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export default async function YayinTakvimiPage() {
  let days: CalendarDay[] = [];
  let error: string | null = null;

  try {
    const calendar = await getCalendar();
    days = filterActiveDays(calendar.data);
  } catch {
    error = "Yayın takvimi şu anda yüklenemedi. Lütfen daha sonra tekrar dene.";
  }

  const totalItems = days.reduce((sum, day) => sum + day.contents.length, 0);
  const totalAiring = days.reduce(
    (sum, day) => sum + day.contents.filter((item) => isCalendarEpisode(item)).length,
    0
  );
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Ana Sayfa", path: "/" },
    { name: "Yayın Takvimi", path: "/yayin-takvimi" },
  ]);

  return (
    <div className="relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,var(--primary)/0.22,transparent_35%),radial-gradient(circle_at_top_right,var(--accent)/0.18,transparent_30%)]" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
        <header className="mb-8 rounded-[2rem] border border-[var(--border)] bg-[var(--card)]/70 p-6 shadow-2xl shadow-black/5 backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                <CalendarDays className="h-4 w-4" />
                Anime yayın akışı
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Yayın Takvimi</h1>
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)] md:text-base">
                Hangi gün hangi animenin yeni bölümü geleceğini, sezonluk bölümleri ve yaklaşan içerikleri tek sayfadan takip et.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[320px]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
                <p className="text-3xl font-black">{days.length}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Takvim günü</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
                <p className="text-3xl font-black">{totalAiring || totalItems}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Bölüm/içerik</p>
              </div>
            </div>
          </div>
        </header>

        {days.length > 0 && (
          <nav className="no-scrollbar sticky top-16 z-20 -mx-4 mb-8 flex gap-2 overflow-x-auto border-y border-[var(--border)] bg-[var(--background)]/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            {days.map((day) => {
              const date = day.contents[0] ? toDate(day.contents[0].release_date) : null;
              return (
                <a
                  key={day.id}
                  href={`#${day.id}`}
                  className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-semibold transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  {date ? formatRelativeDay(date) : day.title}
                </a>
              );
            })}
          </nav>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        )}

        {!error && days.length === 0 && (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-[var(--primary)]" />
            <h2 className="mt-4 text-xl font-bold">Takvimde gösterilecek içerik yok</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Bugünden itibaren yayınlanacak yeni içerik geldiğinde bu sayfa otomatik güncellenecek.
            </p>
          </div>
        )}

        <div className="space-y-10">
          {days.map((day) => (
            <DaySection key={day.id} day={day} />
          ))}
        </div>
      </div>
    </div>
  );
}
