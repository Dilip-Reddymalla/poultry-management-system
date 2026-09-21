import { useState } from "react";
import {
  fetchFarms,
  fetchSheds,
  fetchUnmarkedSummary,
  markUnmarkedAbsent,
  type UnmarkedSummaryResponse,
} from "../../api/resources.js";
import type { Farm, Shed, Shift } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert, SelectField, Spinner, TextField } from "../../components/ui.js";
import { useAuth } from "../../auth/use-auth.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { useGeolocation } from "../../hooks/useGeolocation.js";
import { ShiftChoice } from "./ShiftChoice.js";
import { ApiError } from "../../api/client.js";

interface MarkUnmarkedAbsentDialogProps {
  defaultDate: string;
  defaultFarmId?: string | null;
  defaultShift?: Shift;
  onClose: () => void;
  onSaved: () => void;
}

export function MarkUnmarkedAbsentDialog({
  defaultDate,
  defaultFarmId,
  defaultShift = "MORNING_SHIFT",
  onClose,
  onSaved,
}: MarkUnmarkedAbsentDialogProps): React.ReactElement {
  const { user } = useAuth();
  const { notify } = useToast();
  const showFarm = user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const [date, setDate] = useState(defaultDate);
  const [shift, setShift] = useState<Shift>(defaultShift);
  const [chosenFarmId, setChosenFarmId] = useState(defaultFarmId ?? "");
  const [shedId, setShedId] = useState("");
  const [target, setTarget] = useState<"ALL" | "EMPLOYEES" | "WORKERS">("ALL");
  const [notes, setNotes] = useState("Marked absent (Roster cutoff)");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: showFarm,
  });
  const farmOptions = farms.data ?? [];
  const soleFarmId = farmOptions.length === 1 ? farmOptions[0]!.id : "";
  const farmId = chosenFarmId || defaultFarmId || soleFarmId || (user?.scope.farmId ?? "");

  const sheds = useResource<Shed[]>(
    `sheds:picker:${farmId}`,
    () => fetchSheds(farmId ? { farmId, status: "AVAILABLE" } : { status: "AVAILABLE" }),
    { enabled: farmId !== "" }
  );

  // Live preview query for unmarked summary
  const summaryResource = useResource<UnmarkedSummaryResponse>(
    `unmarked-summary:${date}:${shift}:${farmId}`,
    (signal) => fetchUnmarkedSummary({ date, shift, farmId }, signal),
    { enabled: farmId !== "" && date !== "" && shift !== undefined }
  );

  const summary = summaryResource.data;
  const unmarkedEmployeesCount = summary?.unmarkedEmployees?.length ?? 0;
  const unmarkedWorkersCount = summary?.unmarkedWorkers?.length ?? 0;

  const targetCount =
    target === "ALL"
      ? (summary?.totalUnmarked ?? 0)
      : target === "EMPLOYEES"
        ? unmarkedEmployeesCount
        : unmarkedWorkersCount;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    if (!farmId) {
      setError(new ApiError(400, "Please select a farm first."));
      return;
    }

    if (latitude === null || longitude === null) {
      setError(
        new ApiError(
          0,
          "Location is required to mark attendance records. Please enable GPS location."
        )
      );
      return;
    }

    if (targetCount === 0) {
      setError(
        new ApiError(
          400,
          "There are no unmarked individuals in the selected group to mark as absent."
        )
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await markUnmarkedAbsent({
        date,
        shift,
        farmId,
        ...(shedId ? { shedId } : {}),
        target,
        latitude,
        longitude,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      notify("success", res.message || `Marked ${res.markedCount} people as Absent.`);
      onSaved();
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "Failed to mark unmarked people as absent.")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Mark Unmarked as Absent"
      description="Identify all active workers and employees with no attendance recorded for this shift and mark them as Absent in bulk."
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {farms.error ? <FormAlert error={farms.error} /> : null}

        {locationError && (
          <div className="alert alert--danger">
            <strong>Location Required:</strong> {locationError}
          </div>
        )}
        {locationLoading && (
          <p className="field__hint">
            <Spinner label="Getting location" /> Waiting for GPS location...
          </p>
        )}

        <div className="filters">
          <TextField
            id="unmarked-date"
            label="Roster Date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {showFarm && !soleFarmId && (
            <SelectField
              id="unmarked-farm"
              label="Farm"
              required
              value={farmId}
              onChange={(e) => setChosenFarmId(e.target.value)}
            >
              <option value="">Select a farm</option>
              {farmOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField
            id="unmarked-shed"
            label="Shed Allocation"
            value={shedId}
            disabled={farmId === "" || sheds.loading}
            hint="Optional. Assign an associated shed to the absent records."
            onChange={(e) => setShedId(e.target.value)}
          >
            <option value="">All Sheds / General</option>
            {(sheds.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.number.toLowerCase().includes("ac room")
                  ? "❄️ AC Room"
                  : s.number.toLowerCase().startsWith("shed")
                  ? s.number.replace("-", " ")
                  : `Shed ${s.number}`}
              </option>
            ))}
          </SelectField>
        </div>

        <ShiftChoice value={shift} onChange={setShift} />

        <div className="field">
          <span className="field__label">Target Workforce</span>
          <div className="segmented" role="group" aria-label="Target workforce">
            <button
              type="button"
              className={
                target === "ALL"
                  ? "segmented__item segmented__item--active"
                  : "segmented__item"
              }
              aria-pressed={target === "ALL"}
              onClick={() => setTarget("ALL")}
            >
              All Unmarked ({summary?.totalUnmarked ?? 0})
            </button>
            <button
              type="button"
              className={
                target === "EMPLOYEES"
                  ? "segmented__item segmented__item--active"
                  : "segmented__item"
              }
              aria-pressed={target === "EMPLOYEES"}
              onClick={() => setTarget("EMPLOYEES")}
            >
              Only Employees ({unmarkedEmployeesCount})
            </button>
            <button
              type="button"
              className={
                target === "WORKERS"
                  ? "segmented__item segmented__item--active"
                  : "segmented__item"
              }
              aria-pressed={target === "WORKERS"}
              onClick={() => setTarget("WORKERS")}
            >
              Only Workers ({unmarkedWorkersCount})
            </button>
          </div>
        </div>

        {/* Real-time Unmarked Status Box */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "var(--radius)",
            background: targetCount > 0 ? "var(--surface-sunk)" : "var(--moss-soft)",
            border: `1px solid ${targetCount > 0 ? "var(--line)" : "var(--moss)"}`,
            marginTop: "0.5rem",
          }}
        >
          {summaryResource.loading ? (
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              <Spinner label="Checking roster" /> Checking unrecorded roster for this shift...
            </p>
          ) : targetCount === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--moss)" }}>
              <span style={{ fontSize: "1.25rem" }}>✓</span>
              <strong style={{ fontSize: "0.9rem" }}>
                All active personnel have already been marked for this date and shift!
              </strong>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.95rem", color: "var(--rust)" }}>
                  ⚠️ {targetCount} Unrecorded Person{targetCount > 1 ? "nel" : ""} Found
                </strong>
                <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  ({unmarkedEmployeesCount} Employees · {unmarkedWorkersCount} Workers)
                </span>
              </div>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                Clicking confirm will generate <strong>ABSENT</strong> attendance records for all{" "}
                <strong>{targetCount}</strong> unrecorded individuals with your GPS location stamp.
              </p>
            </div>
          )}
        </div>

        <TextField
          id="unmarked-notes"
          label="Reason / Notes"
          value={notes}
          hint="Audit note attached to the absence records."
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            busy={busy || locationLoading}
            disabled={
              busy ||
              targetCount === 0 ||
              farmId === "" ||
              latitude === null ||
              longitude === null ||
              locationLoading
            }
            style={{
              backgroundColor: "var(--rust, #b91c1c)",
              borderColor: "var(--rust, #b91c1c)",
              color: "#ffffff",
            }}
          >
            Mark {targetCount} as Absent
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
