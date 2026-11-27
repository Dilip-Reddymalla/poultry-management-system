import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button, type ButtonVariant } from "./ui.js";
import { AttendanceAvatar } from "../features/attendance/AttendanceAvatar.js";
import "./Dialog.css";

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
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  busy = false,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Dialog title={title} description={description} onClose={onClose}>
      {children}
      <div className="dialog__footer">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          variant={confirmVariant === "primary" ? "success" : confirmVariant}
          onClick={onConfirm}
          busy={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** Before/after photo visual for deactivate/reactivate confirmation dialogs. */
export function StatusTransitionVisual({
  photoUrl,
  name,
  type,
  deactivating,
}: {
  photoUrl?: string | null;
  name: string;
  type: "WORKER" | "EMPLOYEE";
  deactivating: boolean;
}): React.ReactElement {
  const inactiveStyle: React.CSSProperties = {
    filter: "grayscale(1)",
    opacity: 0.5,
    borderRadius: "50%",
    padding: 2,
    border: "2px dashed var(--line-strong)",
    display: "inline-flex",
  };
  const activeStyle: React.CSSProperties = {
    borderRadius: "50%",
    padding: 2,
    border: "2px solid var(--moss)",
    display: "inline-flex",
  };

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "8px 0 16px",
      }}
    >
      <span style={deactivating ? activeStyle : inactiveStyle}>
        <AttendanceAvatar photoUrl={photoUrl ?? null} name={name} type={type} size={44} />
      </span>
      <span style={{ fontSize: 20, color: "var(--ink-soft)" }}>→</span>
      <span style={deactivating ? inactiveStyle : activeStyle}>
        <AttendanceAvatar photoUrl={photoUrl ?? null} name={name} type={type} size={44} />
      </span>
    </div>
  );
}
