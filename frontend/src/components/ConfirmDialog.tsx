import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from "../hooks/useConfirm";

interface Pending extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Provides an in-app confirmation dialog to everything below it via useConfirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(options => new Promise<boolean>(resolve => {
    pendingRef.current?.resolve(false); // a newer request replaces an unanswered one
    const next = { ...options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);

  const settle = (confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={pending !== null} onOpenChange={open => { if (!open) settle(false); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[1px]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl outline-none">
            <AlertDialog.Title className="text-base font-semibold">{pending?.title}</AlertDialog.Title>
            {pending?.description
              ? <AlertDialog.Description className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{pending.description}</AlertDialog.Description>
              : <AlertDialog.Description className="sr-only">Confirm or cancel this action.</AlertDialog.Description>}
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent" onClick={() => settle(false)}>
                {pending?.cancelLabel ?? "Cancel"}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${pending?.destructive ? "bg-red-600 text-white hover:bg-red-700" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                onClick={() => settle(true)}
              >
                {pending?.confirmLabel ?? "Confirm"}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}
