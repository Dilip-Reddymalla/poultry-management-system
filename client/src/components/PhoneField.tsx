import { useEffect, useId, useMemo, useState } from "react";

export interface CountryCodeOption {
  code: string;
  label: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: "+91", label: "India", flag: "🇮🇳" },
  { code: "+1", label: "USA / Canada", flag: "🇺🇸" },
  { code: "+44", label: "UK", flag: "🇬🇧" },
  { code: "+971", label: "UAE", flag: "🇦🇪" },
  { code: "+966", label: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+974", label: "Qatar", flag: "🇶🇦" },
  { code: "+968", label: "Oman", flag: "🇴🇲" },
  { code: "+965", label: "Kuwait", flag: "🇰🇼" },
  { code: "+973", label: "Bahrain", flag: "🇧🇭" },
  { code: "+880", label: "Bangladesh", flag: "🇧🇩" },
  { code: "+977", label: "Nepal", flag: "🇳🇵" },
  { code: "+94", label: "Sri Lanka", flag: "🇱🇰" },
  { code: "+92", label: "Pakistan", flag: "🇵🇰" },
  { code: "+65", label: "Singapore", flag: "🇸🇬" },
  { code: "+60", label: "Malaysia", flag: "🇲🇾" },
  { code: "+61", label: "Australia", flag: "🇦🇺" },
  { code: "+254", label: "Kenya", flag: "🇰🇪" },
  { code: "+234", label: "Nigeria", flag: "🇳🇬" },
  { code: "+27", label: "South Africa", flag: "🇿🇦" },
];

/** Sort codes by length descending so prefix matching prefers longer codes (e.g. +971 over +9) */
const SORTED_CODES = [...COUNTRY_CODES].sort(
  (a, b) => b.code.length - a.code.length,
);

function parsePhone(rawPhone: string): { countryCode: string; nationalNumber: string } {
  if (!rawPhone || !rawPhone.trim()) {
    return { countryCode: "+91", nationalNumber: "" };
  }

  const clean = rawPhone.trim();

  if (clean.startsWith("+")) {
    for (const item of SORTED_CODES) {
      if (clean.startsWith(item.code)) {
        return {
          countryCode: item.code,
          nationalNumber: clean.slice(item.code.length).replace(/\D/g, ""),
        };
      }
    }
  }

  // If no matching +prefix or raw digits, assume default +91
  return {
    countryCode: "+91",
    nationalNumber: clean.replace(/\D/g, ""),
  };
}

export interface PhoneFieldProps {
  id?: string | undefined;
  label?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  hint?: string | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
  className?: string | undefined;
}

export function PhoneField({
  id: explicitId,
  label = "Phone number",
  value,
  onChange,
  required,
  disabled,
  hint,
  errors,
  placeholder = "98765 43210",
  autoComplete = "tel",
  className,
}: PhoneFieldProps): React.ReactElement {
  const autoId = useId();
  const id = explicitId || autoId;
  const message = errors?.[0];

  const parsed = useMemo(() => parsePhone(value), [value]);
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);

  // Sync internal state if value changed externally
  useEffect(() => {
    const p = parsePhone(value);
    setCountryCode(p.countryCode);
    setNationalNumber(p.nationalNumber);
  }, [value]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value;
    setCountryCode(newCode);
    if (nationalNumber) {
      onChange(`${newCode}${nationalNumber}`);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setNationalNumber(digits);
    if (digits) {
      onChange(`${countryCode}${digits}`);
    } else {
      onChange("");
    }
  };

  return (
    <div className={`field ${className ?? ""}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? <span className="field__required"> *</span> : null}
      </label>

      <div className="phone-field-group">
        <select
          id={`${id}-country`}
          className="input select phone-field-group__country"
          value={countryCode}
          disabled={disabled}
          onChange={handleCountryChange}
          aria-label="Country Code"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code} ({c.label})
            </option>
          ))}
        </select>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={`input phone-field-group__number ${
            errors?.length ? "input--invalid" : ""
          }`}
          value={nationalNumber}
          onChange={handleNumberChange}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? `${id}-error` : undefined}
        />
      </div>

      {hint && !message ? <p className="field__hint">{hint}</p> : null}
      {message ? (
        <p className="field__error" id={`${id}-error`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
