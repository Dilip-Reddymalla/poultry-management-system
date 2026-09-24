import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client.js";
import {
  fetchDesignations,
  promoteWorker,
} from "../../api/resources.js";
import type { Designation, Employee, Worker } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
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

interface PromoteWorkerDialogProps {
  worker: Worker;
  onClose: () => void;
  onPromoted: (employee: Employee) => void;
}

export function PromoteWorkerDialog({
  worker,
  onClose,
  onPromoted,
}: PromoteWorkerDialogProps): React.ReactElement {
  const { t } = useTranslation();

  const designations = useResource<Designation[]>("designations", () =>
    fetchDesignations(),
  );

  const [name, setName] = useState(worker.name);
  const [employeeId, setEmployeeId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [joiningDate, setJoiningDate] = useState(() =>
    toDateInputValue(new Date().toISOString()),
  );
  const [phone, setPhone] = useState(worker.phone || "");

  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await promoteWorker(worker.id, {
        designationId,
        ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
        ...(joiningDate ? { joiningDate } : {}),
        ...(name.trim() !== worker.name ? { name: name.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });

      onPromoted(res.employee);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, t("error.somethingWentWrong")),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={t("workers.promoteDialog.title", "Promote to Employee")}
      description={t(
        "workers.promoteDialog.description",
        "Advance this worker to regular staff. Their historical attendance and biometrics will be safely preserved and transferred.",
      )}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {designations.error ? <FormAlert error={designations.error} /> : null}

        {/* Worker Summary Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            backgroundColor: "var(--surface-sunken, #f8fafc)",
            borderRadius: "8px",
            border: "1px solid var(--line, #e2e8f0)",
          }}
        >
          {worker.photoUrl ? (
            <img
              src={worker.photoUrl}
              alt={worker.name}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "var(--primary-subtle, #e0e7ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                color: "var(--primary, #6366f1)",
              }}
            >
              {worker.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>{worker.name}</div>
            <div className="numeric muted" style={{ fontSize: "0.85rem" }}>
              {worker.workerId} · {worker.farm?.code || ""} {worker.farm?.name || ""}
            </div>
          </div>
        </div>

        {/* Name (can edit if originally misspelled) */}
        <TextField
          id="promote-name"
          label={t("common.fullName", "Full name")}
          required
          value={name}
          errors={error?.fieldErrors.name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Designation */}
        {designations.loading ? (
          <p className="field__hint">
            <Spinner label={t("common.loading", "Loading")} /> {t("common.loading", "Loading designations…")}
          </p>
        ) : (
          <SelectField
            id="promote-designation"
            label={t("employees.designation", "Designation")}
            required
            value={designationId}
            hint={t(
              "workers.promoteDialog.designationHint",
              "The formal position held as an employee (e.g. Supervisor, Shed Incharge).",
            )}
            errors={error?.fieldErrors.designationId}
            onChange={(e) => setDesignationId(e.target.value)}
          >
            <option value="">{t("employees.form.selectDesignation", "Select a designation")}</option>
            {(designations.data ?? []).map((desig) => (
              <option key={desig.id} value={desig.id}>
                {desig.name}
              </option>
            ))}
          </SelectField>
        )}

        {/* Custom or Auto Employee ID */}
        <TextField
          id="promote-employee-id"
          label={t("employees.employeeID", "Employee ID")}
          value={employeeId}
          placeholder={t("workers.promoteDialog.autoIdPlaceholder", "Auto-generated (e.g. FARM-E1)")}
          hint={t(
            "workers.promoteDialog.idHint",
            "Leave blank to automatically assign the next sequential Employee ID.",
          )}
          errors={error?.fieldErrors.employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />

        {/* Joining Date */}
        <TextField
          id="promote-joining-date"
          label={t("employees.joiningDate", "Joining date")}
          type="date"
          value={joiningDate}
          errors={error?.fieldErrors.joiningDate}
          onChange={(e) => setJoiningDate(e.target.value)}
        />

        {/* Phone */}
        <PhoneField
          id="promote-phone"
          label={t("common.phone", "Phone number")}
          value={phone}
          errors={error?.fieldErrors.phone}
          onChange={setPhone}
        />

        {/* Info callout regarding Login Accounts */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "12px",
            backgroundColor: "var(--surface-sunken, #f8fafc)",
            borderRadius: "8px",
            border: "1px dashed var(--line, #cbd5e1)",
            fontSize: "0.875rem",
            color: "var(--text-muted, #64748b)",
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>ℹ️</span>
          <span>
            {t(
              "workers.promoteDialog.loginNotice",
              "Promotion creates a standard employee record. Login credentials and system roles can be created afterwards directly from their new employee profile.",
            )}
          </span>
        </div>

        <div className="dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="primary" type="submit" busy={busy} disabled={!designationId}>
            {t("workers.promoteDialog.submitButton", "Promote to Employee")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
