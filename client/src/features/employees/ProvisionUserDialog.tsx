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
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await provisionEmployeeUser(employee.id, { email, roleId });
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
      description={`${employee.name} signs in the first time with a one-time code sent to the phone on their record, then sets their own password. No password is set here.`}
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
