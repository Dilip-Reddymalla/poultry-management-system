import { useState } from "react";
import { ApiError } from "../../api/client.js";
import {
  fetchFarmShiftTimings,
  resetFarmShiftTiming,
  updateFarmShiftTiming,
} from "../../api/resources.js";
import type { Shift, ShiftTimingItem } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  CardSkeleton,
  ErrorState,
  FormAlert,
  Panel,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";

interface FarmShiftTimingsTabProps {
  farmId: string;
}

export function FarmShiftTimingsTab({ farmId }: FarmShiftTimingsTabProps): React.ReactElement {
  const { can } = useAuth();
  const { notify } = useToast();
  const canManage = can("farm:update");

  const timingsResource = useResource<ShiftTimingItem[]>(
    `farm-shift-timings:${farmId}`,
    () => fetchFarmShiftTimings(farmId),
  );

  const [editingShift, setEditingShift] = useState<ShiftTimingItem | null>(null);
  const [resettingShift, setResettingShift] = useState<Shift | null>(null);

  const shifts = timingsResource.data ?? [];

  async function handleReset(shift: Shift): Promise<void> {
    if (!canManage || resettingShift) return;
    setResettingShift(shift);

    try {
      await resetFarmShiftTiming(farmId, shift);
      notify("success", "Shift timing reset to company/system default.");
      timingsResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to reset shift timing.");
    } finally {
      setResettingShift(null);
    }
  }

  if (timingsResource.loading) {
    return <CardSkeleton />;
  }

  if (timingsResource.error) {
    return (
      <ErrorState
        error={timingsResource.error}
        onRetry={timingsResource.reload}
      />
    );
  }

  const shiftIcons: Record<Shift, string> = {
    MORNING_SHIFT: "🌅",
    AFTERNOON_SHIFT: "☀️",
    NIGHT_SHIFT: "🌙",
    OVERTIME: "⏱️",
  };

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <Panel
        title="Shift Schedule & Working Hours"
        eyebrow="Operating Windows"
      >
        <p style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Configure working windows and attendance punch boundaries for each shift on this farm. Timings not customized here automatically inherit your company defaults.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "1rem" }}>
          {shifts.map((item) => {
            const isCustom = item.source === "FARM";
            const isCompany = item.source === "COMPANY";
            const isResetting = resettingShift === item.shift;
            const disabled = item.isEnabled === false;

            return (
              <div
                key={item.shift}
                style={{
                  border: isCustom ? "1.5px solid var(--moss, #2e7d32)" : "1px solid var(--line, #e5e7eb)",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  backgroundColor: disabled ? "var(--surface-sunken, #f9fafb)" : "var(--surface, #fff)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  position: "relative",
                  opacity: disabled ? 0.65 : 1,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.4rem" }}>{shiftIcons[item.shift]}</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{item.label}</h3>
                        <span style={{ fontSize: "0.72rem", color: "var(--ink-muted, #64748b)" }}>{item.shift}</span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "999px",
                        backgroundColor: disabled
                          ? "var(--surface-muted, #e2e8f0)"
                          : isCustom
                          ? "rgba(46, 125, 50, 0.12)"
                          : isCompany
                          ? "rgba(217, 119, 6, 0.12)"
                          : "var(--surface-sunken, #f1f5f9)",
                        color: disabled
                          ? "var(--ink-muted, #64748b)"
                          : isCustom
                          ? "var(--moss, #2e7d32)"
                          : isCompany
                          ? "var(--clay, #d97706)"
                          : "var(--ink-muted, #64748b)",
                      }}
                    >
                      {disabled
                        ? "Disabled"
                        : isCustom
                        ? "Farm Override"
                        : isCompany
                        ? "Company Default"
                        : "System Default"}
                    </span>
                  </div>

                  <div style={{ margin: "1rem 0 0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
                      Allowed Window
                    </span>
                    <strong style={{ fontSize: "1.1rem", color: "var(--ink, #1e293b)" }}>
                      {item.timeRange}
                    </strong>
                    {item.crossesMidnight && (
                      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--clay, #d97706)", marginTop: "2px" }}>
                        🌙 Crosses midnight boundary
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "1.25rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--line, #f1f5f9)",
                  }}
                >
                  {isCustom ? (
                    <button
                      type="button"
                      disabled={!canManage || isResetting}
                      onClick={() => handleReset(item.shift)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--ink-muted, #64748b)",
                        fontSize: "0.78rem",
                        cursor: canManage ? "pointer" : "default",
                        textDecoration: "underline",
                      }}
                    >
                      {isResetting ? "Resetting…" : "Reset to Default"}
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-muted, #94a3b8)" }}>
                      Standard schedule
                    </span>
                  )}

                  {canManage && (
                    <Button
                      variant="secondary"
                      onClick={() => setEditingShift(item)}
                    >
                      Configure
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Shift Timing Edit Dialog */}
      {editingShift && (
        <ShiftTimingDialog
          farmId={farmId}
          item={editingShift}
          onClose={() => setEditingShift(null)}
          onSaved={() => {
            setEditingShift(null);
            notify("success", "Shift timing updated successfully.");
            timingsResource.reload();
          }}
        />
      )}
    </div>
  );
}

interface ShiftTimingDialogProps {
  farmId: string;
  item: ShiftTimingItem;
  onClose: () => void;
  onSaved: () => void;
}

function ShiftTimingDialog({
  farmId,
  item,
  onClose,
  onSaved,
}: ShiftTimingDialogProps): React.ReactElement {
  const [label, setLabel] = useState(item.label);
  const [startHour, setStartHour] = useState(item.startHour);
  const [startMinute, setStartMinute] = useState(item.startMinute);
  const [endHour, setEndHour] = useState(item.endHour);
  const [endMinute, setEndMinute] = useState(item.endMinute);
  const [crossesMidnight, setCrossesMidnight] = useState(Boolean(item.crossesMidnight));
  const [isEnabled, setIsEnabled] = useState(item.isEnabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Pad numbers for <input type="time">
  const startTimeValue = `${startHour.toString().padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`;
  const endTimeValue = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;

  function handleStartTimeChange(value: string): void {
    const parts = value.split(":");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        setStartHour(h);
        setStartMinute(m);
        if (endHour < h) setCrossesMidnight(true);
      }
    }
  }

  function handleEndTimeChange(value: string): void {
    const parts = value.split(":");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const h = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        setEndHour(h);
        setEndMinute(m);
        if (h < startHour) setCrossesMidnight(true);
        else if (h > startHour) setCrossesMidnight(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const trimmedLabel = label.trim();
      await updateFarmShiftTiming(farmId, item.shift, {
        ...(trimmedLabel ? { label: trimmedLabel } : {}),
        startHour,
        startMinute,
        endHour,
        endMinute,
        crossesMidnight,
        isEnabled,
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "Failed to update shift timing."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={`Configure ${item.label}`}
      description="Set custom working hours for this shift. Workers punching outside this window will be flagged."
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <TextField
          id="shift-label"
          label="Display Label"
          value={label}
          required
          onChange={(e) => setLabel(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem" }}>
          <div className="field">
            <label htmlFor="shift-start" className="field__label">
              Start Time
            </label>
            <input
              id="shift-start"
              type="time"
              className="field__input"
              value={startTimeValue}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="shift-end" className="field__label">
              End Time
            </label>
            <input
              id="shift-end"
              type="time"
              className="field__input"
              value={endTimeValue}
              onChange={(e) => handleEndTimeChange(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={crossesMidnight}
              onChange={(e) => setCrossesMidnight(e.target.checked)}
              style={{ accentColor: "var(--moss, #2e7d32)" }}
            />
            <span>This shift crosses midnight (e.g. 7 PM to 4 AM)</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              style={{ accentColor: "var(--moss, #2e7d32)" }}
            />
            <span>Enable this shift for attendance recording on this farm</span>
          </label>
        </div>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? <Spinner label="Saving…" /> : "Save Schedule"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
