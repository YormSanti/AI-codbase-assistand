import { createContext, useContext } from "react";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

const nativeConfirm: ConfirmFn = async ({ title, description }) =>
  window.confirm(description ? `${title}\n\n${description}` : title);

/** Ask the user to confirm an action with the app's dialog (native prompt outside a ConfirmProvider). */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? nativeConfirm;
}
