import type { Shift, Farm } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { formatDate, todayInputValue } from "../../lib/display.js";
import { Button } from "../../components/ui.js";
import { SHIFT_CONFIG, type ShiftSummaryData } from "./attendance-dashboard-types.js";

export function AttendanceCommandBar({
  date,
  onDateChange,
  onShiftDate,
  dashboardShift,
  onShiftChange,
  totalRecordsCount,
  shiftSummaries,
  showFarmFilter,
  farmList,
  selectedFarmId,
  onFarmChange,
  onRefresh,
}: {
  date: string;
  onDateChange: (date: string) => void;
  onShiftDate: (offsetDays: number) => void;
  dashboardShift: Shift | "";
  onShiftChange: (shift: Shift | "") => void;
  totalRecordsCount: number;
  shiftSummaries: ShiftSummaryData[];
  showFarmFilter: boolean;
  farmList: Farm[];
  selectedFarmId: string;
  onFarmChange: (farmId: string) => void;
  onRefresh: () => void;
}): React.ReactElement {
  const isToday = date === todayInputValue();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        padding: "0.85rem 1.25rem",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Left: Date Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "0.35rem 0.65rem", minHeight: "32px", fontSize: "0.85rem" }}
            onClick={() => onShiftDate(-1)}
            title="Previous Day"
          >
            ◀
          </button>
          <button
            type="button"
            className="button button--ghost"
            style={{
              padding: "0.35rem 0.85rem",
              minHeight: "32px",
              fontSize: "0.85rem",
              fontWeight: isToday ? 700 : 500,
              color: isToday ? "var(--moss)" : "inherit",
              borderLeft: "1px solid var(--line)",
              borderRight: "1px solid var(--line)",
            }}
            onClick={() => onDateChange(todayInputValue())}
          >
            {isToday ? "● Today" : "Today"}
          </button>
          <button
            type="button"
            className="button button--ghost"
            style={{ padding: "0.35rem 0.65rem", minHeight: "32px", fontSize: "0.85rem" }}
            onClick={() => onShiftDate(1)}
            title="Next Day"
          >
            ▶
          </button>
        </div>

        <input
          type="date"
          className="input"
          style={{ width: "155px", padding: "0.35rem 0.65rem", fontSize: "0.875rem" }}
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />

        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)" }}>
          {formatDate(date)}
        </span>
      </div>

      {/* Center: Shift Selector Segmented Control */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          background: "var(--surface-sunk)",
          padding: "2px",
          gap: "2px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="button button--ghost"
          style={{
            padding: "0.3rem 0.65rem",
            minHeight: "30px",
            fontSize: "0.8rem",
            fontWeight: dashboardShift === "" ? 700 : 500,
            background: dashboardShift === "" ? "var(--surface)" : "transparent",
            boxShadow: dashboardShift === "" ? "var(--shadow-sm)" : "none",
            color: dashboardShift === "" ? "var(--ink)" : "var(--ink-soft)",
            border: dashboardShift === "" ? "1px solid var(--line)" : "1px solid transparent",
            borderRadius: "var(--radius-sm, 4px)",
          }}
          onClick={() => onShiftChange("")}
        >
          All Shifts ({totalRecordsCount})
        </button>
        {SHIFTS.map((s) => {
          const meta = SHIFT_CONFIG[s];
          const isSelected = dashboardShift === s;
          const shiftCount = shiftSummaries.find((sum) => sum.shift === s)?.total ?? 0;
          return (
            <button
              key={s}
              type="button"
              className="button button--ghost"
              style={{
                padding: "0.3rem 0.65rem",
                minHeight: "30px",
                fontSize: "0.8rem",
                fontWeight: isSelected ? 700 : 500,
                background: isSelected ? "var(--surface)" : "transparent",
                boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                color: isSelected ? meta.color : "var(--ink-soft)",
                border: isSelected ? `1px solid ${meta.color}` : "1px solid transparent",
                borderRadius: "var(--radius-sm, 4px)",
              }}
              onClick={() => onShiftChange(isSelected ? "" : s)}
              title={`${meta.label} (${meta.timeRange})`}
            >
              <span>{meta.icon} {meta.label}</span>
              <span style={{ fontSize: "0.72rem", opacity: 0.85, marginLeft: "4px", fontWeight: 600 }}>
                ({shiftCount})
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Farm Filter & Quick Refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {showFarmFilter && farmList.length > 0 && (
          <select
            className="input select"
            style={{ width: "200px", padding: "0.35rem 0.65rem", fontSize: "0.875rem" }}
            value={selectedFarmId}
            onChange={(e) => onFarmChange(e.target.value)}
          >
            <option value="">All Farms</option>
            {farmList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.name}
              </option>
            ))}
          </select>
        )}

        <Button
          variant="ghost"
          style={{ minHeight: "32px", padding: "0.35rem 0.65rem", fontSize: "0.85rem" }}
          onClick={onRefresh}
          title="Refresh Attendance Data"
        >
          🔄 Refresh
        </Button>
      </div>
    </div>
  );
}
