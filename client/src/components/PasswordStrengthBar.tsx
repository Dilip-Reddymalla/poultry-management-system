import type React from "react";

interface PasswordStrengthBarProps {
  password: string;
  minLength?: number;
}

/** Visual 4-bar password strength indicator (no reading required). */
export function PasswordStrengthBar({
  password,
  minLength = 8,
}: PasswordStrengthBarProps): React.ReactElement {
  const len = password.length;
  const hasMix = /\d/.test(password) && /[a-zA-Z]/.test(password);
  const score =
    len === 0 ? 0 : len < 4 ? 1 : len < minLength ? 2 : hasMix && len >= minLength + 2 ? 4 : 3;

  const tone =
    score <= 1 ? "var(--rust)" : score === 2 ? "var(--clay)" : "var(--moss)";

  return (
    <div
      className="pw-strength"
      aria-label={`${len}/${minLength}`}
      title={`${len}/${minLength}`}
    >
      <div className="pw-strength__bars">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className="pw-strength__bar"
            style={{
              backgroundColor: step <= score ? tone : "var(--line-strong)",
            }}
          />
        ))}
      </div>
      <span className="pw-strength__badge" style={{ color: score >= 3 ? "var(--moss)" : "var(--ink-faint)" }}>
        {score >= 3 ? "✅" : `${len}/${minLength}`}
      </span>
    </div>
  );
}
