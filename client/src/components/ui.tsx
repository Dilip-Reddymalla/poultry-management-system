import type { ApiError } from "../api/client.js";
import type { Pagination as PaginationMeta } from "../api/types.js";
import { statusLabel, statusTone } from "../lib/display.js";

/* Buttons ----------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
}

export function Button({
  variant = "secondary",
  busy = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  return (
    <button
      {...rest}
      className={["button", `button--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled ?? busy}
      aria-busy={busy || undefined}
    >
      {busy ? <span className="button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/* Surfaces ---------------------------------------------------------------- */

interface PanelProps {
  title?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  bleed?: boolean;
  children: React.ReactNode;
}

export function Panel({
  title,
  eyebrow,
  actions,
  bleed = false,
  children,
}: PanelProps): React.ReactElement {
  return (
    <section className="panel">
      {title || actions ? (
        <header className="panel__head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="panel__title">{title}</h2> : null}
          </div>
          {actions ? <div className="panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bleed ? "panel__body panel__body--bleed" : "panel__body"}>
        {children}
      </div>
    </section>
  );
}

export function StatusTag({ status }: { status: string }): React.ReactElement {
  return (
    <span className={`tag tag--${statusTone(status)}`}>
      <span className="tag__dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

/* Form fields ------------------------------------------------------------- */

interface FieldShellProps {
  id: string;
  label: string;
  // `| undefined` spelled out because callers pass straight through from an
  // optional API error, and exactOptionalPropertyTypes is on.
  hint?: string | undefined;
  errors?: string[] | undefined;
  required?: boolean | undefined;
  children: React.ReactNode;
}

function FieldShell({
  id,
  label,
  hint,
  errors,
  required,
  children,
}: FieldShellProps): React.ReactElement {
  const message = errors?.[0];

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? <span className="field__required"> *</span> : null}
      </label>
      {children}
      {hint && !message ? <p className="field__hint">{hint}</p> : null}
      {message ? (
        <p className="field__error" id={`${id}-error`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string | undefined;
  errors?: string[] | undefined;
}

export function TextField({
  id,
  label,
  hint,
  errors,
  className,
  ...rest
}: TextFieldProps): React.ReactElement {
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors} required={rest.required}>
      <input
        {...rest}
        id={id}
        className={["input", errors?.length ? "input--invalid" : "", className]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? `${id}-error` : undefined}
      />
    </FieldShell>
  );
}

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  hint?: string | undefined;
  errors?: string[] | undefined;
  children: React.ReactNode;
}

export function SelectField({
  id,
  label,
  hint,
  errors,
  className,
  children,
  ...rest
}: SelectFieldProps): React.ReactElement {
  return (
    <FieldShell id={id} label={label} hint={hint} errors={errors} required={rest.required}>
      <select
        {...rest}
        id={id}
        className={["input", "select", errors?.length ? "input--invalid" : "", className]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? `${id}-error` : undefined}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Whatever the form as a whole got wrong, above the fields. */
export function FormAlert({
  error,
}: {
  error: ApiError | null;
}): React.ReactElement | null {
  if (!error) {
    return null;
  }

  return (
    <div className="alert alert--error" role="alert">
      <p className="alert__title">{error.message}</p>
      {error.formErrors.length > 0 ? (
        <ul className="alert__list">
          {error.formErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* States ------------------------------------------------------------------ */

export function Spinner({ label }: { label?: string }): React.ReactElement {
  return (
    <span className="spinner" role="status">
      <span className="visually-hidden">{label ?? "Loading"}</span>
    </span>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}): React.ReactElement {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="skeleton-table__row" key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <span className="skeleton" key={columnIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton(): React.ReactElement {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <span className="skeleton skeleton--sm" />
      <span className="skeleton skeleton--lg" />
      <span className="skeleton skeleton--sm" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="empty">
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{description}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <div className="alert alert--error" role="alert">
      <p className="alert__title">
        {error.isForbidden ? "Not available to your role" : "Could not load"}
      </p>
      <p className="alert__text">{error.message}</p>
      {onRetry && !error.isForbidden ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* Data display ------------------------------------------------------------ */

export function DetailList({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}): React.ReactElement {
  return (
    <dl className="detail-list">
      {items.map((item) => (
        <div className="detail-list__row" key={item.label}>
          <dt className="detail-list__label">{item.label}</dt>
          <dd className="detail-list__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}): React.ReactElement {
  const { page, limit, total, totalPages } = pagination;

  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <p className="pagination__summary numeric">
        {first}–{last} of {total}
      </p>
      <div className="pagination__controls">
        <Button
          variant="secondary"
          onClick={() => {
            onPageChange(page - 1);
          }}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="pagination__page numeric">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          onClick={() => {
            onPageChange(page + 1);
          }}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
