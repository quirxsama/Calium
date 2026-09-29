"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
          Gecici baglanti sorunu
        </p>
        <h1 className="mt-3 text-2xl font-black">Icerikler su an yuklenemedi</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Veri kaynagina ulasilamadi. Biraz sonra yeniden deneyebilirsin.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] transition hover:opacity-90"
        >
          Yeniden dene
        </button>
      </div>
    </main>
  );
}
