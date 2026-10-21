import { useState } from "react";

import { ApiError } from "../../api/client.js";
import { createCompany, updateCompany, type CompanyInput } from "../../api/resources.js";
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
  const [website, setWebsite] = useState(company?.website ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(company?.logoUrl ?? null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setRemoveLogo(false);
    }
  }

  function handleRemoveLogo(): void {
    setLogoFile(null);
    setPreviewUrl(null);
    setRemoveLogo(true);
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload: Partial<CompanyInput> = {
        name,
        code,
        website: website.trim() ? website.trim() : null,
        ...(removeLogo ? { logoUrl: null } : {}),
      };

      const saved = editing
        ? await updateCompany(company.id, payload, logoFile)
        : await createCompany({ name, code, website: website.trim() ? website.trim() : null }, logoFile);

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
          ? "The company name, code, and logo appear inside the app for its employees."
          : "A company owns the farms beneath it. Only the System Admin can add one."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "8px",
              border: "1px dashed var(--line, #cbd5e1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--bg-subtle, #f8fafc)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Logo preview"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontSize: "10px", color: "var(--ink-muted, #64748b)", textAlign: "center" }}>
                No logo
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label
              htmlFor="company-logo-input"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}
            >
              Company Logo (optional)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                id="company-logo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                style={{ fontSize: "0.8125rem", color: "var(--ink-muted, #64748b)" }}
              />
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    background: "none",
                    border: "1px solid var(--line, #cbd5e1)",
                    borderRadius: "4px",
                    color: "var(--crimson, #dc2626)",
                    cursor: "pointer",
                  }}
                >
                  Remove logo
                </button>
              )}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", margin: "0.25rem 0 0" }}>
              Replaces the in-app brand mark for all company employees.
            </p>
          </div>
        </div>

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

        <TextField
          id="company-website"
          label="Company Website / URL (optional)"
          type="url"
          value={website}
          placeholder="https://example.com"
          hint="Website or portal link shown on company and farm profiles."
          errors={error?.fieldErrors.website}
          onChange={(event) => {
            setWebsite(event.target.value);
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
