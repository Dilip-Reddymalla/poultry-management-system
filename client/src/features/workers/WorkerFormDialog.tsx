import { useState } from "react";

import { ApiError } from "../../api/client.js";
import {
  createWorker,
  fetchFarms,
  updateWorker,
  type WorkerInput,
} from "../../api/resources.js";
import type { Farm, Worker } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface FormState {
  workerId: string;
  name: string;
  farmId: string;
  phone: string;
}

function initialState(worker: Worker | null): FormState {
  return {
    workerId: worker?.workerId ?? "",
    name: worker?.name ?? "",
    farmId: worker?.farm.id ?? "",
    phone: worker?.phone ?? "",
  };
}

interface WorkerFormDialogProps {
  /** Null means create. */
  worker: Worker | null;
  onClose: () => void;
  onSaved: (worker: Worker, mode: "created" | "updated") => void;
}

/** Mounted only while open, so the form starts clean every time. */
export function WorkerFormDialog({
  worker,
  onClose,
  onSaved,
}: WorkerFormDialogProps): React.ReactElement {
  const editing = worker !== null;

  const [form, setForm] = useState<FormState>(() => initialState(worker));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // A worker's farm is permanent, so it is only chosen at creation. fetchFarms is
  // scope-limited server-side and collapses to a single locked choice for a farm
  // user, so it never offers a farm outside their reach.
  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: !editing,
  });

  const farmOptions = farms.data ?? [];
  const soleFarmId = farmOptions.length === 1 ? farmOptions[0]!.id : "";
  // Derived, not stored: a farm user's sole farm locks in without an effect to
  // reconcile state once the list loads.
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

    // Phone is the only optional field: cleared on edit, omitted on create.
    const payload: WorkerInput = {
      name: form.name,
      phone: form.phone || (editing ? null : undefined),
    };

    try {
      const saved = editing
        ? await updateWorker(worker.id, payload)
        : await createWorker({
            ...payload,
            workerId: form.workerId,
            farmId: effectiveFarmId,
          });

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
      title={editing ? "Edit worker" : "Add worker"}
      description={
        editing
          ? "Worker ID, farm and status are managed elsewhere."
          : "Workers are recorded for attendance only. They never get a login."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {farms.error ? <FormAlert error={farms.error} /> : null}

        {editing ? null : (
          <TextField
            id="worker-id"
            label="Worker ID"
            required
            value={form.workerId}
            hint="The number on their card, for example WRK-021."
            errors={error?.fieldErrors.workerId}
            onChange={field("workerId")}
          />
        )}

        {editing ? null : farms.loading ? (
          <p className="field__hint">
            <Spinner label="Loading farms" /> Loading farms…
          </p>
        ) : (
          <SelectField
            id="worker-farm"
            label="Farm"
            required
            disabled={soleFarmId !== ""}
            value={effectiveFarmId}
            hint={
              soleFarmId
                ? "Workers are added to your farm."
                : "The farm this worker belongs to. It cannot be changed later."
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
          id="worker-name"
          label="Full name"
          required
          value={form.name}
          errors={error?.fieldErrors.name}
          onChange={field("name")}
        />

        <TextField
          id="worker-phone"
          label="Phone number"
          type="tel"
          value={form.phone}
          hint="Optional. For contact only — workers do not sign in."
          errors={error?.fieldErrors.phone}
          onChange={field("phone")}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? "Save changes" : "Add worker"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
