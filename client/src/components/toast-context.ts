import { createContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ToastContextValue {
  notify: (tone: ToastTone, message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
