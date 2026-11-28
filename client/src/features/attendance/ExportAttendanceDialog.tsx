import { useState } from "react";

import type { Farm } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, TextField } from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";
import { fetchFarms, exportAttendanceUrl, type ExportAttendanceQuery } from "../../api/resources.js";
import { todayInputValue } from "../../lib/display.js";
import {
  getLastSelectedFarmId,
} from "../../lib/farm-selection.js";


export function ExportAttendanceDialog({
  onClose,
}: {
  onClose: () => void;
}): React.ReactElement {
  const [scope, setScope] = useState<"employees" | "workers" | "all">("all");
  const [dateMode, setDateMode] = useState<"day" | "range">("day");
  const [date, setDate] = useState(todayInputValue());
  const [from, setFrom] = useState(todayInputValue());
  const [to, setTo] = useState(todayInputValue());
  const [farmId, setFarmId] = useState(() => getLastSelectedFarmId() || "");

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms());

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const query: ExportAttendanceQuery = {
      scope,
      ...(farmId !== "" ? { farmId } : {}),
      ...(dateMode === "day" ? { date } : { from, to }),
    };

    setDownloading(true);
    setError(null);
    try {
      // Fetch with credentials so the session cookie is sent (works on the
      // cross-origin API path), then hand the bytes to the browser as a
      // download. This also surfaces failures instead of silently navigating.
      const res = await fetch(exportAttendanceUrl(query), {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Export failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_export_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog title="Export Attendance" description="Download attendance records as an Excel spreadsheet." onClose={onClose}>
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <label className="field-row">
          <span className="label">Export Scope</span>
          <select className="input select" value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="all">All People (Employees & Workers)</option>
            <option value="employees">Employees Only</option>
            <option value="workers">Workers Only</option>
          </select>
        </label>

        <label className="field-row">
          <span className="label">Date Filter</span>
          <select className="input select" value={dateMode} onChange={(e) => setDateMode(e.target.value as any)}>
            <option value="day">Specific Day</option>
            <option value="range">Date Range</option>
          </select>
        </label>

        {dateMode === "day" ? (
          <TextField
            id="export-date"
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        ) : (
          <div className="field-row">
            <TextField
              id="export-from"
              label="From"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              id="export-to"
              label="To"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        )}

        <label className="field-row">
          <span className="label">Farm (Optional)</span>
          <select className="input select" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            <option value="">All Farms</option>
            {(farms.data ?? []).map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.code} — {farm.name}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p
            style={{ color: "#dc2626", fontSize: 13, margin: "0 0 8px" }}
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={downloading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={downloading}>
            {downloading ? "Exporting…" : "Export to Excel"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
