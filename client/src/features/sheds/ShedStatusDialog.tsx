import { useState } from "react";

import { ApiError } from "../../api/client.js";
import { updateShedStatus } from "../../api/resources.js";
import {
  MANAGEABLE_SHED_STATUSES,
  type ManageableShedStatus,
  type Shed,
} from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert, SelectField } from "../../components/ui.js";
import { statusLabel } from "../../lib/display.js";

const STATUS_NOTES: Record<ManageableShedStatus, string> = {
  AVAILABLE: "Ready to take a batch.",
  OCCUPIED: "Currently housing a batch.",
  MAINTENANCE: "Out of use while work is done on it.",
  INACTIVE: "Kept on record but not in use.",
};

interface ShedStatusDialogProps {
  shed: Shed;
  onClose: () => void;
  onUpdated: (shed: Shed) => void;
}

/**
 * Occupied is set by batch placement, not by hand, so it is not offered here —
 * the API rejects it too.
 */
export function ShedStatusDialog({
  shed,
  onClose,
  onUpdated,
}: ShedStatusDialogProps): React.ReactElement {
  const [status, setStatus] = useState<ManageableShedStatus>(() =>
    MANAGEABLE_SHED_STATUSES.includes(shed.status as ManageableShedStatus)
      ? (shed.status as ManageableShedStatus)
      : "AVAILABLE",
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const updated = await updateShedStatus(shed.id, status);

      onUpdated(updated);
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
      title={`Set status for shed ${shed.number}`}
      description="Occupied is set when a batch is placed, so it is not chosen here."
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <SelectField
          id="shed-status"
          label="Status"
          required
          value={status}
          hint={STATUS_NOTES[status]}
          errors={error?.fieldErrors.status}
          onChange={(event) => {
            setStatus(event.target.value as ManageableShedStatus);
          }}
        >
          {MANAGEABLE_SHED_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </SelectField>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save status
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
