import type { Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { SHIFT_TIMINGS, validateShiftTiming } from "../../lib/shift-timing.js";

interface ShiftChoiceProps {
  value: Shift;
  onChange: (shift: Shift) => void;
  label?: string;
  errors?: string[] | undefined;
}

export function ShiftChoice({
  value,
  onChange,
  label = "Shift",
  errors,
}: ShiftChoiceProps): React.ReactElement {
  const message = errors?.[0];
  const timingCheck = validateShiftTiming(value);

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="statuschoice" role="group" aria-label={label}>
        {SHIFTS.map((shift) => {
          const active = shift === value;
          const timing = SHIFT_TIMINGS[shift];

          return (
            <button
              key={shift}
              type="button"
              className={
                active
                  ? "statuschoice__item statuschoice__item--active"
                  : "statuschoice__item"
              }
              data-tone="running"
              aria-pressed={active}
              title={timing?.timeRange}
              onClick={() => {
                onChange(shift);
              }}
            >
              <span className="statuschoice__dot" aria-hidden="true" />
              <span>{timing?.shortLabel ?? shift}</span>
              <span style={{ fontSize: "0.72rem", opacity: 0.75, display: "block" }}>
                {timing?.timeRange}
              </span>
            </button>
          );
        })}
      </div>
      {!timingCheck.allowed && (
        <p className="field__hint" style={{ color: "var(--clay, #d97706)", marginTop: "0.35rem" }}>
          ⚠️ <strong>Note:</strong> {timingCheck.message}
        </p>
      )}
      {message ? <p className="field__error">{message}</p> : null}
    </div>
  );
}
