import { useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import {
  downloadEmployeeTemplateUrl,
  downloadWorkerTemplateUrl,
  importEmployeesExcel,
  importWorkersExcel,
  type ExcelImportSummary,
} from "../api/resources.js";
import { Dialog } from "./Dialog.js";
import { Button, FormAlert, Spinner } from "./ui.js";

interface ExcelImportDialogProps {
  type: "employee" | "worker";
  onClose: () => void;
  onSuccess: () => void;
}

export function ExcelImportDialog({
  type,
  onClose,
  onSuccess,
}: ExcelImportDialogProps): React.ReactElement {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [summary, setSummary] = useState<ExcelImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const entityTitle = type === "employee" ? "Employees" : "Workers";
  const templateUrl =
    type === "employee"
      ? downloadEmployeeTemplateUrl()
      : downloadWorkerTemplateUrl();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSummary(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError(new ApiError(400, "Please select an Excel file to import."));
      return;
    }

    setBusy(true);
    setError(null);
    setSummary(null);

    try {
      const res =
        type === "employee"
          ? await importEmployeesExcel(selectedFile)
          : await importWorkersExcel(selectedFile);

      setSummary(res.summary);
      if (res.summary.addedCount > 0) {
        onSuccess();
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "Failed to process Excel file."),
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadFailedExcel = () => {
    if (!summary?.failedExcelBase64) return;
    const byteCharacters = atob(summary.failedExcelBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = summary.filename || `${type}_import_errors.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      title={`Import ${entityTitle} from Excel`}
      description={`Upload an Excel sheet (.xlsx, .xls, or .csv) to import ${entityTitle.toLowerCase()} in bulk.`}
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 16 }}>
        <FormAlert error={error} />

        {/* Template info banner */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--surface-secondary, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>Need formatted template?</strong>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Download our sample Excel file with pre-configured headers.
            </div>
          </div>
          <a
            href={templateUrl}
            download
            style={{
              padding: "6px 12px",
              fontSize: 13,
              borderRadius: 6,
              background: "#4f46e5",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📥 Template
          </a>
        </div>

        {/* File Select Form */}
        {!summary && (
          <form onSubmit={handleUpload} className="stack" style={{ gap: 16 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: 8,
                padding: "24px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: selectedFile ? "#f0fdf4" : "#fafafa",
                transition: "all 0.2s",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              {selectedFile ? (
                <div>
                  <strong style={{ color: "#166534" }}>{selectedFile.name}</strong>
                  <div style={{ fontSize: 12, color: "#4b5563" }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB — Click to change file
                  </div>
                </div>
              ) : (
                <div>
                  <strong>Click to upload or drag & drop Excel sheet</strong>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Supports .xlsx, .xls, and .csv files
                  </div>
                </div>
              )}
            </div>

            <div className="dialog__footer">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || busy}
              >
                {busy ? <Spinner label="Processing..." /> : "🚀 Upload & Import"}
              </Button>
            </div>
          </form>
        )}

        {/* Summary Results */}
        {summary && (
          <div className="stack" style={{ gap: 16 }}>
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: summary.addedCount > 0 ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${summary.addedCount > 0 ? "#bbf7d0" : "#fef08a"}`,
              }}
            >
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Import Results Summary
              </h4>
              <div style={{ marginTop: 8, fontSize: 14 }}>
                <div>• Total Rows Processed: <strong>{summary.totalCount}</strong></div>
                <div style={{ color: "#166534" }}>
                  • Successfully Added: <strong>{summary.addedCount}</strong>
                </div>
                {summary.failedCount > 0 && (
                  <div style={{ color: "#dc2626" }}>
                    • Failed Rows: <strong>{summary.failedCount}</strong>
                  </div>
                )}
              </div>
            </div>

            {summary.failedCount > 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  ⚠️ {summary.failedCount} row(s) could not be imported due to validation errors.
                </div>
                <p style={{ fontSize: 13, margin: "0 0 10px 0" }}>
                  Click below to download an Excel sheet containing only the failed rows with the exact <strong>Error Reason</strong> for each row.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={downloadFailedExcel}
                  style={{ background: "#dc2626", borderColor: "#dc2626" }}
                >
                  📥 Download Failed Rows Excel ({summary.failedCount})
                </Button>
              </div>
            )}

            <div className="dialog__footer">
              <Button type="button" variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
