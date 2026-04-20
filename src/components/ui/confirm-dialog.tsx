"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: async () => false,
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmText: "Onayla",
    cancelText: "Vazgeç",
    variant: "default",
    resolve: null,
  });

  const closeWith = useCallback((value: boolean) => {
    setState((prev) => {
      prev.resolve?.(value);
      return { ...prev, open: false, resolve: null };
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText ?? "Onayla",
        cancelText: options.cancelText ?? "Vazgeç",
        variant: options.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog.Root open={state.open} onOpenChange={(open) => !open && closeWith(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-semibold">{state.title}</Dialog.Title>
                {state.description ? (
                  <Dialog.Description className="mt-2 text-sm text-[var(--muted-foreground)]">
                    {state.description}
                  </Dialog.Description>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => closeWith(false)}
                className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeWith(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                onClick={() => closeWith(true)}
                className={
                  state.variant === "danger"
                    ? "rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
                }
              >
                {state.confirmText}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}
