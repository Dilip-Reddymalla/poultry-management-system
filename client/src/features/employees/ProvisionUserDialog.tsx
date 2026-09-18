import { useState } from "react";

import { ApiError } from "../../api/client.js";
import { fetchRoles, provisionEmployeeUser } from "../../api/resources.js";
import type { Employee, Role } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface ProvisionUserDialogProps {
  employee: Employee;
  onClose: () => void;
  onProvisioned: () => void;
}

/** Gives an existing employee a login. Roles come from `GET /api/roles`. */
export function ProvisionUserDialog({
  employee,
  onClose,
  onProvisioned,
}: ProvisionUserDialogProps): React.ReactElement {
  const roles = useResource<Role[]>("roles", () => fetchRoles());

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await provisionEmployeeUser(employee.id, {
        email,
        roleId,
        password: password.trim() ? password.trim() : undefined,
      });
      onProvisioned();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "Something went wrong."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Create a login"
      description={`${employee.name} can sign in with this email or phone number. You can optionally set a password now so they won't need to configure one, or leave it blank to require first-login phone OTP verification.`}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {roles.error ? <FormAlert error={roles.error} /> : null}

        <TextField
          id="user-email"
          label="Work email"
          type="email"
          autoComplete="off"
          required
          value={email}
          hint="They can sign in with this email or the phone on their record."
          errors={error?.fieldErrors.email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />

        {roles.loading ? (
          <p className="field__hint">
            <Spinner label="Loading roles" /> Loading roles…
          </p>
        ) : (
          <SelectField
            id="user-role"
            label="Role"
            required
            value={roleId}
            hint="The role decides what they can do in the app."
            errors={error?.fieldErrors.roleId}
            onChange={(event) => {
              setRoleId(event.target.value);
            }}
          >
            <option value="">Select a role</option>
            {(roles.data ?? []).map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
                {role.description ? ` — ${role.description}` : ""}
              </option>
            ))}
          </SelectField>
        )}

        <div style={{ position: "relative" }}>
          <TextField
            id="user-password"
            label="Password (optional)"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            hint="Set a password to skip setup on first login, or leave blank to require phone OTP setup."
            errors={error?.fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />
          {password ? (
            <button
              type="button"
              style={{
                position: "absolute",
                right: "0.75rem",
                top: "2.1rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                color: "var(--color-primary-600, #2563eb)",
              }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          ) : null}
        </div>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Create login
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
