import { useState } from "react";

import { ApiError } from "../../api/client.js";
import { createShed, fetchFarms, updateShed } from "../../api/resources.js";
import type { Farm, Shed } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface ShedFormDialogProps {
  /** Null means create. */
  shed: Shed | null;
  /** Preselected farm when creating from a farm-filtered list. */
  defaultFarmId?: string;
  onClose: () => void;
  onSaved: (shed: Shed, mode: "created" | "updated") => void;
}

/** Mounted only while open, so the form starts clean every time. */
export function ShedFormDialog({
  shed,
  defaultFarmId,
  onClose,
  onSaved,
}: ShedFormDialogProps): React.ReactElement {
  const editing = shed !== null;

  // A shed cannot move between farms, so the farm is only asked for on create.
  const farms = useResource<Farm[]>(
    "farms:ACTIVE",
    (signal) => fetchFarms("ACTIVE", signal),
    { enabled: !editing },
  );

  const [farmId, setFarmId] = useState(shed?.farm.id ?? defaultFarmId ?? "");
  const [number, setNumber] = useState(shed?.number ?? "");
  const [capacity, setCapacity] = useState(shed ? String(shed.capacity) : "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const saved = editing
        ? await updateShed(shed.id, { number, capacity: Number(capacity) })
        : await createShed({ farmId, number, capacity: Number(capacity) });

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
      title={editing ? "Edit shed" : "Add shed"}
      description={
        editing
          ? "The farm is fixed and status is set from the shed page."
          : "New sheds start as available."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {farms.error ? <FormAlert error={farms.error} /> : null}

        {editing ? null : farms.loading ? (
          <p className="field__hint">
            <Spinner label="Loading farms" /> Loading farms…
          </p>
        ) : (
          <SelectField
            id="shed-farm"
            label="Farm"
            required
            value={farmId}
            errors={error?.fieldErrors.farmId}
            onChange={(event) => {
              setFarmId(event.target.value);
            }}
          >
            <option value="">Select a farm</option>
            {(farms.data ?? []).map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.code} — {farm.name}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          id="shed-number"
          label="Shed number"
          required
          value={number}
          hint="How the shed is labelled on the farm, for example 4 or S-04."
          errors={error?.fieldErrors.number}
          onChange={(event) => {
            setNumber(event.target.value);
          }}
        />

        <TextField
          id="shed-capacity"
          label="Bird capacity"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          className="numeric"
          value={capacity}
          errors={error?.fieldErrors.capacity}
          onChange={(event) => {
            setCapacity(event.target.value);
          }}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? "Save changes" : "Add shed"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
