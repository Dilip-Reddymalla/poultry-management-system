import { useState } from "react";

import { ApiError } from "../../api/client.js";
import { fetchRoles, updateEmployeeUserRole } from "../../api/resources.js";
import type { Employee, Role } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface ChangeRoleDialogProps {
  employee: Employee;
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}

export function ChangeRoleDialog({
  employee,
  onClose,
  onSaved,
}: ChangeRoleDialogProps): React.ReactElement {
  const { user } = useAuth();
  const roles = useResource<Role[]>("roles", () => fetchRoles());

  const currentRoleId = employee.user?.roles?.[0]?.id ?? "";
  const [roleId, setRoleId] = useState(currentRoleId);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // If the actor is DGM (not Company Admin or System Admin), they cannot assign Company Admin / Global roles
  const isDgmOnly =
    !user?.isSystemAdmin &&
    !user?.roles?.includes("Company Admin") &&
    user?.roles?.includes("DGM");

  const availableRoles = (roles.data ?? []).filter((r) => {
    if (isDgmOnly && (r.name === "Company Admin" || r.name === "System Admin")) {
      return false;
    }
    return true;
  });

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!roleId) return;

    setBusy(true);
    setError(null);

    try {
      const response = await updateEmployeeUserRole(employee.id, roleId);
      onSaved(response.employee);
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
      title="Change login role"
      description={`Update the assigned role and access level for ${employee.name} (${employee.user?.email ?? "User"}).`}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {roles.error ? <FormAlert error={roles.error} /> : null}

        {roles.loading ? (
          <p className="field__hint">
            <Spinner label="Loading roles" /> Loading roles…
          </p>
        ) : (
          <SelectField
            id="update-user-role"
            label="Select new role"
            required
            value={roleId}
            hint="The role determines the permissions and functions accessible by this employee."
            errors={error?.fieldErrors.roleId}
            onChange={(event) => {
              setRoleId(event.target.value);
            }}
          >
            <option value="">Select a role</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.description ? ` — ${r.description}` : ""}
              </option>
            ))}
          </SelectField>
        )}

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            disabled={!roleId || roleId === currentRoleId}
          >
            Save role
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
