import { useState } from "react";

import { ApiError } from "../../api/client.js";
import {
  createFarm,
  fetchCompanies,
  updateFarm,
} from "../../api/resources.js";
import type { Company, Farm } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface FarmFormDialogProps {
  /** Null means create. */
  farm: Farm | null;
  onClose: () => void;
  onSaved: (farm: Farm, mode: "created" | "updated") => void;
}

/** Mounted only while open, so the form starts clean every time. */
export function FarmFormDialog({
  farm,
  onClose,
  onSaved,
}: FarmFormDialogProps): React.ReactElement {
  const editing = farm !== null;

  // The owning company is fixed at creation, so it is only asked for once.
  const companies = useResource<Company[]>("companies", () => fetchCompanies(), {
    enabled: !editing,
  });

  const [companyId, setCompanyId] = useState(farm?.company.id ?? "");
  const [code, setCode] = useState(farm?.code ?? "");
  const [name, setName] = useState(farm?.name ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const saved = editing
        ? await updateFarm(farm.id, { code, name })
        : await createFarm({ companyId, code, name });

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
      title={editing ? "Edit farm" : "Add farm"}
      description={
        editing
          ? "The owning company and status are managed elsewhere."
          : "A farm holds the sheds that birds are placed in."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {companies.error ? <FormAlert error={companies.error} /> : null}

        {editing ? null : companies.loading ? (
          <p className="field__hint">
            <Spinner label="Loading companies" /> Loading companies…
          </p>
        ) : (
          <SelectField
            id="farm-company"
            label="Company"
            required
            value={companyId}
            errors={error?.fieldErrors.companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
            }}
          >
            <option value="">Select a company</option>
            {(companies.data ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.code} — {company.name}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          id="farm-code"
          label="Farm code"
          required
          value={code}
          hint="Short code used on paperwork, for example F-01."
          errors={error?.fieldErrors.code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />

        <TextField
          id="farm-name"
          label="Farm name"
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
            {editing ? "Save changes" : "Add farm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
