import type { Shift, Farm } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { formatDate, todayInputValue } from "../../lib/display.js";
import { Button } from "../../components/ui.js";
import { SHIFT_CONFIG, type ShiftSummaryData } from "./attendance-dashboard-types.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

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
  isMobile: isMobileProp,
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
  isMobile?: boolean;
}): React.ReactElement {
  const isMobile = isMobileProp ?? useIsMobile();
  const isToday = date === todayInputValue();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Sticky Mobile Top Date & Action Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.75rem",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            gap: "0.4rem",
          }}
        >
          {/* Date Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ display: "inline-flex", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
              <button
                type="button"
                className="button button--ghost"
                style={{ padding: "0.2rem 0.45rem", minHeight: "28px", fontSize: "0.75rem" }}
                onClick={() => onShiftDate(-1)}
                title="Previous Day"
              >
                ◀
              </button>
              <button
                type="button"
                className="button button--ghost"
                style={{
                  padding: "0.2rem 0.55rem",
                  minHeight: "28px",
                  fontSize: "0.75rem",
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
                style={{ padding: "0.2rem 0.45rem", minHeight: "28px", fontSize: "0.75rem" }}
                onClick={() => onShiftDate(1)}
                title="Next Day"
              >
                ▶
              </button>
            </div>

            {/* Native Date Picker trigger */}
            <input
              type="date"
              className="input"
              style={{
                width: "36px",
                padding: "0.2rem 0.3rem",
                fontSize: "0.8rem",
                color: "transparent",
                cursor: "pointer",
                background: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%2346574e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/></svg>') center center no-repeat",
              }}
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              title="Pick Date"
            />

            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>
              {formatDate(date)}
            </span>
          </div>

          {/* Quick Refresh & Multi-farm */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            {showFarmFilter && farmList.length > 0 && (
              <select
                className="input select"
                style={{ width: "105px", padding: "0.2rem 0.4rem", fontSize: "0.75rem", height: "28px" }}
                value={selectedFarmId}
                onChange={(e) => onFarmChange(e.target.value)}
              >
                <option value="">All Farms</option>
                {farmList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="button button--ghost"
              style={{ minHeight: "28px", padding: "0.2rem 0.45rem", fontSize: "0.8rem" }}
              onClick={onRefresh}
              title="Refresh Attendance Data"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Horizontal Shift Selector Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            overflowX: "auto",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            padding: "2px",
            gap: "4px",
            background: "var(--surface-sunk)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
          }}
        >
          <button
            type="button"
            className="button button--ghost"
            style={{
              flex: "0 0 auto",
              padding: "0.3rem 0.6rem",
              minHeight: "28px",
              fontSize: "0.78rem",
              fontWeight: dashboardShift === "" ? 700 : 500,
              background: dashboardShift === "" ? "var(--surface)" : "transparent",
              boxShadow: dashboardShift === "" ? "var(--shadow-sm)" : "none",
              color: dashboardShift === "" ? "var(--ink)" : "var(--ink-soft)",
              border: dashboardShift === "" ? "1px solid var(--line)" : "1px solid transparent",
              borderRadius: "var(--radius-sm, 4px)",
              whiteSpace: "nowrap",
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
                  flex: "0 0 auto",
                  padding: "0.3rem 0.6rem",
                  minHeight: "28px",
                  fontSize: "0.78rem",
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "var(--surface)" : "transparent",
                  boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                  color: isSelected ? meta.color : "var(--ink-soft)",
                  border: isSelected ? `1px solid ${meta.color}` : "1px solid transparent",
                  borderRadius: "var(--radius-sm, 4px)",
                  whiteSpace: "nowrap",
                }}
                onClick={() => onShiftChange(isSelected ? "" : s)}
              >
                <span>{meta.icon} {meta.label.split(" ")[0]}</span>
                <span style={{ fontSize: "0.7rem", opacity: 0.85, marginLeft: "3px", fontWeight: 600 }}>
                  ({shiftCount})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
