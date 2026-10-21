import type { Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import {
  SHIFT_TIMINGS,
  isTimeInShiftWindow,
  validateShiftTiming,
  type ShiftTimingRule,
} from "../../lib/shift-timing.js";

interface ShiftChoiceProps {
  value: Shift;
  onChange: (shift: Shift) => void;
  label?: string;
  errors?: string[] | undefined;
  shiftRules?: Record<Shift, ShiftTimingRule>;
}

export function ShiftChoice({
  value,
  onChange,
  label = "Shift",
  errors,
  shiftRules = SHIFT_TIMINGS,
}: ShiftChoiceProps): React.ReactElement {
  const message = errors?.[0];
  const timingCheck = validateShiftTiming(value, new Date(), shiftRules);

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="statuschoice" role="group" aria-label={label}>
        {SHIFTS.map((shift) => {
          const active = shift === value;
          const timing = shiftRules[shift] ?? SHIFT_TIMINGS[shift];
          const isLiveNow = timing ? isTimeInShiftWindow(timing) : false;
          const disabled = timing?.isEnabled === false;

          return (
            <button
              key={shift}
              type="button"
              disabled={disabled}
              className={
                active
                  ? "statuschoice__item statuschoice__item--active"
                  : "statuschoice__item"
              }
              data-tone="running"
              aria-pressed={active}
              title={timing?.timeRange}
              onClick={() => {
                if (!disabled) {
                  onChange(shift);
                }
              }}
              style={{
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.25rem" }}>
                <span className="statuschoice__dot" aria-hidden="true" />
                {isLiveNow && !disabled && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      backgroundColor: "var(--moss, #2e7d32)",
                      color: "#fff",
                      padding: "1px 5px",
                      borderRadius: "999px",
                    }}
                  >
                    ● Live
                  </span>
                )}
                {disabled && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      backgroundColor: "var(--surface-muted, #78716c)",
                      color: "#fff",
                      padding: "1px 5px",
                      borderRadius: "999px",
                    }}
                  >
                    Off
                  </span>
                )}
              </div>
              <span style={{ fontWeight: 600 }}>{timing?.shortLabel ?? shift}</span>
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
