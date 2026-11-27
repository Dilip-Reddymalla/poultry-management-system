import type React from "react";
import type { Farm, Shed, Shift } from "../../../api/types.js";
import { SHIFTS } from "../../../api/types.js";
import { SHIFT_ICONS, SHIFT_TIMINGS, validateShiftTiming } from "../../../lib/shift-timing.js";
import { styles } from "./face-attendance.styles.js";

function shiftLabel(shift: Shift): string {
  return SHIFT_TIMINGS[shift]?.label ?? shift;
}

interface FaceAttendanceControlsProps {
  farms: Farm[];
  selectedFarmId: string;
  onSelectFarmId: (farmId: string) => void;
  sheds: Shed[];
  selectedShedId: string;
  onSelectShedId: (shedId: string) => void;
  selectedShift: Shift;
  onSelectShift: (shift: Shift) => void;
  facingMode: "user" | "environment";
  onChangeFacingMode: (mode: "user" | "environment") => void;
  locationStatus: string;
  hasValidLocation: boolean;
  isGpsLoading: boolean;
  onRequestGpsLocation: () => void;
}

export function FaceAttendanceControls({
  farms,
  selectedFarmId,
  onSelectFarmId,
  sheds,
  selectedShedId,
  onSelectShedId,
  selectedShift,
  onSelectShift,
  facingMode,
  onChangeFacingMode,
  locationStatus,
  hasValidLocation,
  isGpsLoading,
  onRequestGpsLocation,
}: FaceAttendanceControlsProps): React.ReactElement {
  const acRoomShed = sheds.find(
    (s) => s.number.toLowerCase() === "ac room" || s.number.toLowerCase().includes("ac room"),
  );
  const regularSheds = sheds.filter((s) => s.id !== acRoomShed?.id);
  const shiftCheck = validateShiftTiming(selectedShift);
  const hideFarmSelect = farms.length === 1 && selectedFarmId === farms[0]?.id;
  const hideShedSelect = sheds.length === 1 && selectedShedId === sheds[0]?.id;

  const gpsDot = isGpsLoading ? "🟡" : hasValidLocation ? "🟢" : "🔴";
  const gpsShortLabel = isGpsLoading ? "GPS…" : hasValidLocation ? "GPS" : "No GPS";

  return (
    <>
      <div style={styles.controls} className="face-controls">
        {/* Farm Select (hidden when user only has 1 farm) */}
        {!hideFarmSelect && (
          <select
            style={styles.select}
            value={selectedFarmId}
            onChange={(e) => onSelectFarmId(e.target.value)}
          >
            <option value="">Select Farm</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </select>
        )}

        {/* Shed Select (hidden when farm only has 1 shed) */}
        {!hideShedSelect && (
          <select
            data-tour="face-shed"
            style={styles.select}
            value={selectedShedId}
            disabled={!selectedFarmId}
            onChange={(e) => onSelectShedId(e.target.value)}
          >
            <option value="">🏢 General / Unassigned</option>
            {acRoomShed ? (
              <option value={acRoomShed.id}>❄️ AC Room</option>
            ) : (
              <option value="AC_ROOM">❄️ AC Room</option>
            )}
            {regularSheds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number.toLowerCase().startsWith("shed")
                  ? s.number.replace("-", " ")
                  : `Shed ${s.number}`}
              </option>
            ))}
          </select>
        )}

        {/* Shift Emoji Tabs */}
        <div className="segmented" role="group" aria-label="Shift" style={{ width: "auto" }}>
          {SHIFTS.map((sh) => (
            <button
              key={sh}
              type="button"
              className={selectedShift === sh ? "segmented__item segmented__item--active" : "segmented__item"}
              aria-pressed={selectedShift === sh}
              aria-label={shiftLabel(sh)}
              title={shiftLabel(sh)}
              onClick={() => onSelectShift(sh)}
            >
              {SHIFT_ICONS[sh]}
            </button>
          ))}
        </div>

        {/* Camera Select */}
        <select
          data-tour="face-camera"
          style={styles.select}
          value={facingMode}
          onChange={(e) => onChangeFacingMode(e.target.value as "user" | "environment")}
        >
          <option value="user">📷 Front</option>
          <option value="environment">📸 Back</option>
        </select>

        {/* Traffic-light GPS indicator */}
        <div
          title={locationStatus}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            background: hasValidLocation ? "#f0fdf4" : isGpsLoading ? "#fefce8" : "#fef2f2",
            border: `1px solid ${hasValidLocation ? "#bbf7d0" : isGpsLoading ? "#fde68a" : "#fecaca"}`,
            color: hasValidLocation ? "#166534" : isGpsLoading ? "#854d0e" : "#991b1b",
          }}
        >
          <span>{gpsDot} {gpsShortLabel}</span>
          <button
            type="button"
            disabled={isGpsLoading}
            title={locationStatus}
            style={{
              padding: "2px 8px",
              fontSize: 12,
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: isGpsLoading ? "#f3f4f6" : "#fff",
              cursor: isGpsLoading ? "not-allowed" : "pointer",
            }}
            onClick={onRequestGpsLocation}
          >
            🔄
          </button>
        </div>
      </div>

      {!shiftCheck.allowed && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...styles.card, padding: 12, marginBottom: 0, ...styles.warning }}>
            ⚠️ <strong>Shift Timing Warning:</strong> {shiftCheck.message}
          </div>
        </div>
      )}
    </>
  );
}
