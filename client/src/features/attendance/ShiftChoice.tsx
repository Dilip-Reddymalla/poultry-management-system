import type { Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { statusLabel } from "../../lib/display.js";

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

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="statuschoice" role="group" aria-label={label}>
        {SHIFTS.map((shift) => {
          const active = shift === value;

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
              onClick={() => {
                onChange(shift);
              }}
            >
              <span className="statuschoice__dot" aria-hidden="true" />
              {statusLabel(shift)}
            </button>
          );
        })}
      </div>
      {message ? <p className="field__error">{message}</p> : null}
    </div>
  );
}
