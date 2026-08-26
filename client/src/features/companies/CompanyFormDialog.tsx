import { useState } from "react";

import { ApiError } from "../../api/client.js";
import { createCompany, updateCompany } from "../../api/resources.js";
import type { Company } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";

interface CompanyFormDialogProps {
  /** Null means create. */
  company: Company | null;
  onClose: () => void;
  onSaved: (company: Company, mode: "created" | "updated") => void;
}

/** Mounted only while open, so the form starts clean every time. */
export function CompanyFormDialog({
  company,
  onClose,
  onSaved,
}: CompanyFormDialogProps): React.ReactElement {
  const editing = company !== null;

  const [name, setName] = useState(company?.name ?? "");
  const [code, setCode] = useState(company?.code ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const saved = editing
        ? await updateCompany(company.id, { name, code })
        : await createCompany({ name, code });

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
      title={editing ? "Edit company" : "Add company"}
      description={
        editing
          ? "The company name and code appear on its farms and paperwork."
          : "A company owns the farms beneath it. Only the System Admin can add one."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <TextField
          id="company-code"
          label="Company code"
          required
          value={code}
          hint="Short code used on paperwork, for example CO-01."
          errors={error?.fieldErrors.code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />

        <TextField
          id="company-name"
          label="Company name"
          required
          value={name}
          errors={error?.fieldErrors.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? "Save changes" : "Add company"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
