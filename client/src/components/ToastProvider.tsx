import { useCallback, useMemo, useRef, useState } from "react";

import {
  ToastContext,
  type Toast,
  type ToastTone,
} from "./toast-context.js";

const DISMISS_AFTER_MS = 5000;

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;

      setToasts((current) => [...current, { id, tone, message }]);

      window.setTimeout(() => {
        dismiss(id);
      }, DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => {
                dismiss(toast.id);
              }}
            >
              <span className="visually-hidden">Dismiss</span>×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
