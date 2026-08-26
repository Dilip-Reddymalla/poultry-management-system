import { useState } from "react";

import type { Farm } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, TextField } from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";
import { fetchFarms, exportAttendanceUrl, type ExportAttendanceQuery } from "../../api/resources.js";
import { todayInputValue } from "../../lib/display.js";

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
  const [farmId, setFarmId] = useState("");

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms());

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const query: ExportAttendanceQuery = {
      scope,
      ...(farmId !== "" ? { farmId } : {}),
      ...(dateMode === "day" ? { date } : { from, to }),
    };

    // The backend uses a session cookie, so a direct navigation to the
    // export URL will authenticate and trigger the download.
    window.location.href = exportAttendanceUrl(query);
    onClose();
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

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Export to Excel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
