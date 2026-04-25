"use client";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth/context";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { SyncProvider } from "@/components/providers/sync-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      themes={["light", "dark", "oled"]}
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <ServiceWorkerRegister />
        <SyncProvider />
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
