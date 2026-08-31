import { useState } from "react";

import { ApiError } from "../../api/client.js";
import {
  createEmployee,
  fetchFarms,
  updateEmployee,
  type EmployeeInput,
} from "../../api/resources.js";
import type { Designation, Employee, Farm } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { CameraPhotoInput } from "../../components/CameraPhotoInput.js";
import { PhoneField } from "../../components/PhoneField.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";
import { toDateInputValue } from "../../lib/display.js";

interface FormState {
  employeeId?: string;
  name: string;
  farmId: string;
  designationId: string;
  phone: string;
  photoUrl: string;
  joiningDate: string;
}

function initialState(employee: Employee | null): FormState {
  return {
    employeeId: employee?.employeeId ?? "",
    name: employee?.name ?? "",
    farmId: employee?.farm.id ?? "",
    designationId: employee?.designation.id ?? "",
    phone: employee?.phone ?? "",
    photoUrl: employee?.photoUrl ?? "",
    joiningDate: toDateInputValue(employee?.joiningDate ?? null),
  };
}

interface EmployeeFormDialogProps {
  /** Null means create. */
  employee: Employee | null;
  designations: Designation[];
  designationsError: ApiError | null;
  onClose: () => void;
  onSaved: (employee: Employee, mode: "created" | "updated") => void;
}

/** Mounted only while open, so the form starts clean every time. */
export function EmployeeFormDialog({
  employee,
  designations,
  designationsError,
  onClose,
  onSaved,
}: EmployeeFormDialogProps): React.ReactElement {
  const editing = employee !== null;

  const [form, setForm] = useState<FormState>(() => initialState(employee));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // A farm is permanent once set, so it is only chosen at creation. fetchFarms is
  // scope-limited on the server: a farm user gets exactly their own farm back, so
  // the list never leaks and collapses to a single locked choice for them.
  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: !editing,
  });

  const farmOptions = farms.data ?? [];
  const soleFarmId = farmOptions.length === 1 ? farmOptions[0]!.id : "";
  // A farm user gets exactly one farm, so it locks; anyone else picks. Derived,
  // not stored, so no effect is needed to reconcile it once the list loads.
  const effectiveFarmId = form.farmId || soleFarmId;

  function field<K extends keyof FormState>(key: K) {
    return (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ): void => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    // Blank optional fields are cleared on edit and omitted on create, matching
    // what the API accepts for each.
    const payload: EmployeeInput = {
      name: form.name,
      designationId: form.designationId,
      phone: form.phone || (editing ? null : undefined),
      photoUrl: form.photoUrl || (editing ? null : undefined),
      joiningDate: form.joiningDate || (editing ? null : undefined),
    };

    try {
      const saved = editing
        ? await updateEmployee(employee.id, payload, photoFile)
        : await createEmployee(
            {
              ...payload,
              employeeId: form.employeeId,
              farmId: effectiveFarmId,
            },
            photoFile,
          );

      onSaved(saved, editing ? "updated" : "created");
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
      title={editing ? "Edit employee" : "Add employee"}
      description={
        editing
          ? "Employee ID, farm and user account are managed elsewhere."
          : "An employee record must exist before a user account can be assigned."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {designationsError ? <FormAlert error={designationsError} /> : null}
        {farms.error ? <FormAlert error={farms.error} /> : null}

        {editing ? null : (
          <TextField
            id="employeeId"
            label="Employee ID"
            value={form.employeeId}
            hint="For example EMP-001."
            errors={error?.fieldErrors.employeeId}
            onChange={field("employeeId")}
          />
        )}

        {editing ? null : farms.loading ? (
          <p className="field__hint">
            <Spinner label="Loading farms" /> Loading farms…
          </p>
        ) : (
          <SelectField
            id="farmId"
            label="Farm"
            required
            disabled={soleFarmId !== ""}
            value={effectiveFarmId}
            hint={
              soleFarmId
                ? "Employees are added to your farm."
                : "The farm this employee belongs to. It cannot be changed later."
            }
            errors={error?.fieldErrors.farmId}
            onChange={field("farmId")}
          >
            <option value="">Select a farm</option>
            {farmOptions.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.code} — {farm.name}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          id="name"
          label="Full name"
          required
          value={form.name}
          errors={error?.fieldErrors.name}
          onChange={field("name")}
        />

        <SelectField
          id="designationId"
          label="Designation"
          required
          value={form.designationId}
          errors={error?.fieldErrors.designationId}
          onChange={field("designationId")}
        >
          <option value="">Select a designation</option>
          {designations.map((designation) => (
            <option key={designation.id} value={designation.id}>
              {designation.name}
            </option>
          ))}
        </SelectField>

        <PhoneField
          id="phone"
          label="Phone number"
          value={form.phone}
          hint="Used for OTP or password sign-in. Select country code."
          errors={error?.fieldErrors.phone}
          onChange={(val) => setForm((curr) => ({ ...curr, phone: val }))}
        />

        <TextField
          id="joiningDate"
          label="Joining date"
          type="date"
          value={form.joiningDate}
          errors={error?.fieldErrors.joiningDate}
          onChange={field("joiningDate")}
        />

        <CameraPhotoInput
          label="Employee Face Photo (Live / Upload)"
          currentPhotoUrl={form.photoUrl || null}
          onChange={(file) => setPhotoFile(file)}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? "Save changes" : "Add employee"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
