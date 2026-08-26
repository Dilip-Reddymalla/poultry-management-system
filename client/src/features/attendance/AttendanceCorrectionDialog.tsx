import { useState } from "react";

import { ApiError } from "../../api/client.js";
import {
  correctAttendance,
  type AttendanceCorrection,
} from "../../api/resources.js";
import type { Attendance, AttendanceStatus } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { StatusChoice } from "./StatusChoice.js";

interface AttendanceCorrectionDialogProps {
  record: Attendance;
  onClose: () => void;
  onSaved: (record: Attendance) => void;
}

/**
 * Corrects the mutable fields of an existing record. Person, farm and date are
 * fixed at creation, so they are shown read-only. Saving reopens the record: any
 * prior approval is cleared and a manager must approve the corrected values.
 */
export function AttendanceCorrectionDialog({
  record,
  onClose,
  onSaved,
}: AttendanceCorrectionDialogProps): React.ReactElement {
  const [status, setStatus] = useState<AttendanceStatus>(record.status);
  const [notes, setNotes] = useState(record.notes ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload: AttendanceCorrection = {
      status,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    try {
      const saved = await correctAttendance(record.id, payload);

      onSaved(saved);
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
      title="Correct attendance"
      description={`${record.person.name} · ${record.date}. Saving clears any approval so it can be reviewed again.`}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <StatusChoice
          value={status}
          onChange={setStatus}
          errors={error?.fieldErrors?.status}
        />

        <TextField
          id="correct-notes"
          label="Notes"
          value={notes}
          hint="Leave blank to clear the note."
          errors={error?.fieldErrors?.notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save correction
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
