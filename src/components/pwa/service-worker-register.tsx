"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const markUpdateReady = (worker: ServiceWorker) => {
      setWaitingWorker(worker);
      setUpdateReady(true);
      window.dispatchEvent(new CustomEvent("calium:pwa-update-ready"));
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        if (cancelled) return;

        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

        if (registration.waiting && navigator.serviceWorker.controller) {
          markUpdateReady(registration.waiting);
        }

        navigator.serviceWorker.ready
          .then((readyRegistration) => readyRegistration.update())
          .catch(() => {
            // Update checks are best-effort; normal navigation must remain unaffected.
          });

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              markUpdateReady(installingWorker);
            }
          });
        });
      } catch {
        // Service worker registration is progressive enhancement; ignore failures.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  if (!updateReady || !waitingWorker) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-[120] mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 p-4 text-sm text-[var(--foreground)] shadow-2xl backdrop-blur-xl md:bottom-6">
      <p className="font-semibold">Calium güncellemesi hazır</p>
      <p className="mt-1 text-[var(--muted-foreground)]">
        Yeni PWA sürümünü yüklemek için uygulamayı güvenli şekilde yenile.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-full bg-[var(--primary)] px-4 py-2 font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
          onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
        >
          Güncelle
        </button>
        <button
          type="button"
          className="rounded-full border border-[var(--border)] px-4 py-2 font-semibold transition hover:bg-[var(--muted)]"
          onClick={() => setUpdateReady(false)}
        >
          Sonra
        </button>
      </div>
    </div>
  );
}
