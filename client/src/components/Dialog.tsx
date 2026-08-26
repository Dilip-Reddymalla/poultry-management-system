import { useEffect, useRef } from "react";

import { Button, type ButtonVariant } from "./ui.js";

interface DialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Modal built on <dialog> so the browser handles focus trapping, Escape and the
 * top layer instead of hand-rolled key handlers.
 *
 * A dialog exists only while it is open: callers mount it to open it and
 * unmount it to close it, which also resets whatever form state it holds.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
}: DialogProps): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      <div className="dialog__inner">
        <header className="dialog__head">
          <h2 className="dialog__title">{title}</h2>
          {description ? (
            <p className="dialog__description">{description}</p>
          ) : null}
        </header>
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Dialog title={title} description={description} onClose={onClose}>
      <div className="dialog__footer">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} busy={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
