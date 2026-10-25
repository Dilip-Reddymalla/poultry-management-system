import { useState } from "react";
import { ApiError } from "../../api/client.js";
import {
  fetchFarm,
  fetchFarmShiftTimings,
  resetFarmShiftTiming,
  updateFarm,
  updateFarmShiftTiming,
} from "../../api/resources.js";
import type { Farm, Shift, ShiftTimingItem } from "../../api/types.js";
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

function formatCutoffTime(endHour: number, endMinute: number, graceMinutes: number): string {
  const totalMinutes = endHour * 60 + endMinute + graceMinutes;
  const modMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h24 = Math.floor(modMinutes / 60);
  const m = modMinutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = String(m).padStart(2, "0");
  const hStr = String(h12).padStart(2, "0");
  return `${hStr}:${mStr} ${period}`;
}

export function FarmShiftTimingsTab({ farmId }: FarmShiftTimingsTabProps): React.ReactElement {
  const { can } = useAuth();
  const { notify } = useToast();
  const canManage = can("farm:update");

  const farmResource = useResource<Farm>(
    `farm:${farmId}`,
    () => fetchFarm(farmId),
  );

  const timingsResource = useResource<ShiftTimingItem[]>(
    `farm-shift-timings:${farmId}`,
    () => fetchFarmShiftTimings(farmId),
  );

  const [editingShift, setEditingShift] = useState<ShiftTimingItem | null>(null);
  const [resettingShift, setResettingShift] = useState<Shift | null>(null);
  const [togglingAutoAbsent, setTogglingAutoAbsent] = useState(false);

  const shifts = timingsResource.data ?? [];
  const farm = farmResource.data;
  const isAutoAbsentOn = farm?.autoAbsentEnabled !== false;

  const savedGrace = farm?.autoAbsentGraceMinutes ?? 5;
  const [customGrace, setCustomGrace] = useState<number | null>(null);
  const [savingGrace, setSavingGrace] = useState(false);
  const effectiveGrace = customGrace !== null ? customGrace : savedGrace;
  const isGraceDirty = customGrace !== null && customGrace !== savedGrace;

  async function handleToggleAutoAbsent(): Promise<void> {
    if (!canManage || togglingAutoAbsent || !farm) return;
    setTogglingAutoAbsent(true);

    try {
      const nextVal = !isAutoAbsentOn;
      const updated = await updateFarm(farmId, { autoAbsentEnabled: nextVal });
      farmResource.replace(updated);
      notify(
        "success",
        nextVal
          ? "Automatic absent cutoffs enabled for this farm."
          : "Automatic absent cutoffs disabled for this farm.",
      );
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to update auto-absent status.");
    } finally {
      setTogglingAutoAbsent(false);
    }
  }

  async function handleSaveGrace(): Promise<void> {
    if (!canManage || savingGrace || !farm) return;
    setSavingGrace(true);

    try {
      const updated = await updateFarm(farmId, { autoAbsentGraceMinutes: effectiveGrace });
      farmResource.replace(updated);
      setCustomGrace(null);
      notify("success", `Auto-absent cutoff buffer updated to +${effectiveGrace} minutes.`);
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to update grace buffer.");
    } finally {
      setSavingGrace(false);
    }
  }

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
        title="Automated Absent Marking"
        eyebrow="Attendance Policy"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ maxWidth: "620px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.95rem" }}>
              <span>Auto-Absent Status:</span>
              {isAutoAbsentOn ? (
                <span className="tag" style={{ background: "var(--moss-soft)", color: "var(--moss)", fontWeight: 700 }}>
                  ● Active (Enabled)
                </span>
              ) : (
                <span className="tag" style={{ background: "var(--rust-soft, #fee2e2)", color: "var(--rust, #dc2626)", fontWeight: 700 }}>
                  ○ Disabled
                </span>
              )}
            </div>
            <p style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.85rem", marginTop: "0.4rem", marginBottom: 0, lineHeight: 1.45 }}>
              When enabled, active employees and workers without recorded attendance are automatically marked as <strong>ABSENT</strong> after each shift end time plus the configured grace buffer.
            </p>
          </div>
          {canManage && (
            <Button
              variant={isAutoAbsentOn ? "secondary" : "primary"}
              busy={togglingAutoAbsent}
              onClick={handleToggleAutoAbsent}
              style={{ minWidth: "160px" }}
            >
              {isAutoAbsentOn ? "Turn Off Auto-Absent" : "Turn On Auto-Absent"}
            </Button>
          )}
        </div>

        {/* Grace Buffer Customizer */}
        <div
          style={{
            marginTop: "1.25rem",
            padding: "1rem 1.25rem",
            background: "var(--surface-sunken, #f8fafc)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                Shift End Grace Buffer
              </h4>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-muted, #64748b)" }}>
                Extra time allowed after the shift closes before unrecorded staff are marked absent.
              </p>
            </div>

            {canManage && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {isGraceDirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCustomGrace(null)}
                    disabled={savingGrace}
                  >
                    Reset
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  busy={savingGrace}
                  disabled={!isGraceDirty}
                  onClick={handleSaveGrace}
                >
                  Save Buffer
                </Button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
            <input
              id="grace-minutes-input"
              type="number"
              min={0}
              max={360}
              value={String(effectiveGrace)}
              disabled={!canManage || savingGrace}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCustomGrace(Number.isNaN(val) ? 0 : Math.max(0, Math.min(360, val)));
              }}
              className="input"
              style={{ width: "85px", textAlign: "center", fontWeight: 700, fontSize: "1rem" }}
            />
            <span style={{ fontSize: "0.875rem", color: "var(--ink-muted, #64748b)", fontWeight: 500 }}>
              minutes after shift ends
            </span>

            {/* Quick Presets */}
            {canManage && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginLeft: "auto", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--ink-muted, #64748b)", marginRight: "0.25rem" }}>
                  Presets:
                </span>
                {[0, 5, 10, 15, 30, 60].map((preset) => {
                  const isSelected = effectiveGrace === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={savingGrace}
                      onClick={() => setCustomGrace(preset)}
                      style={{
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.78rem",
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: "999px",
                        border: isSelected ? "1.5px solid var(--moss, #2e7d32)" : "1px solid var(--line, #cbd5e1)",
                        background: isSelected ? "var(--moss, #2e7d32)" : "var(--surface, #ffffff)",
                        color: isSelected ? "#ffffff" : "var(--ink, #1e293b)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {preset === 0 ? "0m (Immediate)" : preset === 5 ? "5m (Default)" : `${preset}m`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Cutoff Schedule Preview */}
          <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--line, #e2e8f0)", paddingTop: "1rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Calculated Auto-Absent Cutoff Times
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "0.5rem" }}>
              {shifts
                .filter((s) => s.isEnabled !== false && s.shift !== "OVERTIME")
                .map((s) => {
                  const cutoffTime = formatCutoffTime(s.endHour, s.endMinute, effectiveGrace);
                  return (
                    <div
                      key={s.shift}
                      style={{
                        padding: "0.65rem 0.85rem",
                        borderRadius: "6px",
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--line, #e2e8f0)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <span>{shiftIcons[s.shift]}</span>
                          <span>{s.label}</span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--ink-muted, #64748b)", marginTop: "2px" }}>
                          Ends {formatCutoffTime(s.endHour, s.endMinute, 0)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: isAutoAbsentOn ? "var(--moss, #2e7d32)" : "var(--ink-muted, #94a3b8)" }}>
                          {cutoffTime}
                        </div>
                        <span style={{ fontSize: "0.68rem", color: isAutoAbsentOn ? "var(--moss, #2e7d32)" : "var(--rust, #dc2626)" }}>
                          {isAutoAbsentOn ? `+${effectiveGrace}m buffer` : "Paused"}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </Panel>

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
