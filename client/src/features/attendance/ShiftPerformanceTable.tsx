import type { Shift } from "../../api/types.js";
import { Panel } from "../../components/ui.js";
import { SHIFT_CONFIG, type ShiftSummaryData } from "./attendance-dashboard-types.js";

export function ShiftPerformanceTable({
  shiftSummaries,
  dashboardShift,
  onShiftSelect,
}: {
  shiftSummaries: ShiftSummaryData[];
  dashboardShift: Shift | "";
  onShiftSelect: (shift: Shift | "") => void;
}): React.ReactElement {
  return (
    <Panel
      title="Shift Performance Breakdown"
      eyebrow="Turnout by Shift"
      actions={
        dashboardShift !== "" ? (
          <button
            type="button"
            className="button button--ghost"
            style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }}
            onClick={() => onShiftSelect("")}
          >
            Show All Shifts ✕
          </button>
        ) : null
      }
    >
      <div className="table-scroll" style={{ margin: "-0.5rem -1rem" }}>
        <table className="table" style={{ fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th scope="col">Shift</th>
              <th scope="col" style={{ textAlign: "center" }}>Total</th>
              <th scope="col" style={{ textAlign: "center" }}>Present</th>
              <th scope="col" style={{ textAlign: "center" }}>Absent</th>
              <th scope="col" style={{ textAlign: "center" }}>Turnout</th>
              <th scope="col" style={{ textAlign: "right" }}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {shiftSummaries.map((s) => {
              const meta = SHIFT_CONFIG[s.shift];
              const isSelected = dashboardShift === s.shift;
              const hasData = s.total > 0;
              const rate = hasData ? Math.round(((s.present + s.halfDay) / s.total) * 100) : 0;

              return (
                <tr
                  key={s.shift}
                  onClick={() => onShiftSelect(isSelected ? "" : s.shift)}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? "var(--moss-soft)" : undefined,
                    fontWeight: isSelected ? 600 : undefined,
                    transition: "background 150ms ease",
                  }}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.15rem" }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: meta.color }}>
                          {meta.label}
                        </div>
                        <div className="muted" style={{ fontSize: "0.72rem" }}>
                          {meta.timeRange}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{s.total}</td>
                  <td style={{ textAlign: "center", color: "var(--moss)", fontWeight: 600 }}>
                    {s.present}
                    {s.halfDay > 0 && (
                      <span style={{ fontSize: "0.72rem", color: "var(--clay)", marginLeft: "2px" }}>
                        +{s.halfDay}H
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center", color: s.absent > 0 ? "var(--rust)" : "var(--ink-soft)" }}>
                    {s.absent > 0 ? <strong>{s.absent}</strong> : "0"}
                    {s.leave > 0 && (
                      <span style={{ fontSize: "0.72rem", color: "var(--clay)", marginLeft: "2px" }}>
                        +{s.leave}L
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {hasData ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <span style={{ fontWeight: 700, color: rate >= 75 ? "var(--moss)" : rate >= 50 ? "var(--clay)" : "var(--rust)" }}>
                          {rate}%
                        </span>
                        <div style={{ width: "48px", height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${rate}%`,
                              height: "100%",
                              background: rate >= 75 ? "var(--moss)" : rate >= 50 ? "var(--clay)" : "var(--rust)",
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className={`button ${isSelected ? "button--primary" : "button--ghost"}`}
                      style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem", minHeight: "24px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onShiftSelect(isSelected ? "" : s.shift);
                      }}
                    >
                      {isSelected ? "Active ✓" : "Filter"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
