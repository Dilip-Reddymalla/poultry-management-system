import type { AttendanceStatus } from "../../api/types.js";
import { ATTENDANCE_STATUSES } from "../../api/types.js";
import { statusLabel, statusTone } from "../../lib/display.js";

interface StatusChoiceProps {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  label?: string;
  errors?: string[] | undefined;
}

/**
 * The four attendance statuses as a segmented control. The active option wears
 * its status colour so present/absent reads at a glance — the point of the
 * roster. Tone rides on a data attribute so its rule outranks the base item
 * style regardless of stylesheet order.
 */
export function StatusChoice({
  value,
  onChange,
  label = "Status",
  errors,
}: StatusChoiceProps): React.ReactElement {
  const message = errors?.[0];

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="statuschoice" role="group" aria-label={label}>
        {ATTENDANCE_STATUSES.map((status) => {
          const active = status === value;

          return (
            <button
              key={status}
              type="button"
              className={
                active
                  ? "statuschoice__item statuschoice__item--active"
                  : "statuschoice__item"
              }
              data-tone={statusTone(status)}
              aria-pressed={active}
              onClick={() => {
                onChange(status);
              }}
            >
              <span className="statuschoice__dot" aria-hidden="true" />
              {statusLabel(status)}
            </button>
          );
        })}
      </div>
      {message ? <p className="field__error">{message}</p> : null}
    </div>
  );
}
