import type React from "react";
import type { Farm, Shed, Shift } from "../../../api/types.js";
import { SHIFTS } from "../../../api/types.js";
import { SHIFT_TIMINGS, validateShiftTiming } from "../../../lib/shift-timing.js";
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

  return (
    <>
      <div style={styles.controls} className="face-controls">
        {/* Farm Select */}
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

        {/* Shed Select */}
        <select
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

        {/* Shift Select */}
        <select
          style={styles.select}
          value={selectedShift}
          onChange={(e) => onSelectShift(e.target.value as Shift)}
        >
          {SHIFTS.map((sh) => (
            <option key={sh} value={sh}>
              {shiftLabel(sh)}
            </option>
          ))}
        </select>

        {/* Camera Select */}
        <select
          style={styles.select}
          value={facingMode}
          onChange={(e) => onChangeFacingMode(e.target.value as "user" | "environment")}
        >
          <option value="user">📷 Front Camera (Portrait)</option>
          <option value="environment">📸 Back Camera (16:9 Widescreen)</option>
        </select>
      </div>

      {/* GPS & Shift Status Info Banner */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div
          style={{
            ...styles.card,
            flex: 1,
            padding: "10px 16px",
            marginBottom: 0,
            fontSize: 13,
            background: hasValidLocation ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${hasValidLocation ? "#bbf7d0" : "#fecaca"}`,
            color: hasValidLocation ? "#166534" : "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            <strong>{locationStatus}</strong>
          </span>
          <button
            type="button"
            disabled={isGpsLoading}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: isGpsLoading ? "#f3f4f6" : "#fff",
              cursor: isGpsLoading ? "not-allowed" : "pointer",
            }}
            onClick={onRequestGpsLocation}
          >
            {isGpsLoading ? "⏳ Detecting…" : "🔄 Refresh GPS"}
          </button>
        </div>
        {!shiftCheck.allowed && (
          <div style={{ ...styles.card, flex: 2, padding: 12, marginBottom: 0, ...styles.warning }}>
            ⚠️ <strong>Shift Timing Warning:</strong> {shiftCheck.message}
          </div>
        )}
      </div>
    </>
  );
}
