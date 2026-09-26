import { useState } from "react";
import type { Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { formatNumber } from "../../lib/display.js";
import { Panel } from "../../components/ui.js";
import {
  SHIFT_CONFIG,
  type ShiftShedRow,
  type ShiftSummaryData,
  type AttendanceMetrics,
} from "./attendance-dashboard-types.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export function ShiftShedMatrixTable({
  shiftShedMatrix,
  shiftSummaries,
  selectedShedId,
  dashboardShift,
  onSelectCell,
  onSelectShed,
  onSelectShift,
  onResetFilters,
  metrics,
  isMobile: isMobileProp,
}: {
  shiftShedMatrix: ShiftShedRow[];
  shiftSummaries: ShiftSummaryData[];
  selectedShedId: string;
  dashboardShift: Shift | "";
  onSelectCell: (shedId: string, shift: Shift) => void;
  onSelectShed: (shedId: string) => void;
  onSelectShift: (shift: Shift) => void;
  onResetFilters: () => void;
  metrics: AttendanceMetrics;
  isMobile?: boolean;
}): React.ReactElement {
  const isMobile = isMobileProp ?? useIsMobile();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <Panel
      title="Shift × Shed Cross-Tab Matrix"
      eyebrow="Station vs Shift Deployment"
      actions={
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {isMobile && (
            <button
              type="button"
              className="button button--secondary"
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.55rem", minHeight: "26px" }}
              onClick={() => setMobileExpanded(!mobileExpanded)}
            >
              {mobileExpanded ? "Collapse ▴" : "Expand Matrix ▾"}
            </button>
          )}
          {(selectedShedId || dashboardShift) && (
            <button
              type="button"
              className="button button--ghost"
              style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }}
              onClick={onResetFilters}
            >
              Reset Filters ✕
            </button>
          )}
        </div>
      }
    >
      {isMobile && !mobileExpanded ? (
        <div
          onClick={() => setMobileExpanded(true)}
          style={{
            cursor: "pointer",
            padding: "0.85rem 1rem",
            background: "var(--surface-sunk)",
            borderRadius: "var(--radius)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.82rem",
            color: "var(--ink)",
          }}
        >
          <div>
            <strong>Tap to expand 2D cross-tab matrix</strong>
            <div className="muted" style={{ fontSize: "0.74rem", marginTop: "2px" }}>
              {shiftShedMatrix.length} sheds across 4 shifts ({metrics.totalPresent + metrics.halfDayCount}/{metrics.totalMarked} on duty)
            </div>
          </div>
          <span style={{ fontSize: "1rem", color: "var(--moss)", fontWeight: 700 }}>+</span>
        </div>
      ) : (
      <div className="table-scroll">
        <table className="table" style={{ fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th scope="col" style={{ minWidth: "160px" }}>Shed / Station</th>
              {SHIFTS.map((s) => {
                const meta = SHIFT_CONFIG[s];
                const isColActive = dashboardShift === s;
                return (
                  <th
                    key={s}
                    scope="col"
                    onClick={() => onSelectShift(s)}
                    style={{
                      textAlign: "center",
                      cursor: "pointer",
                      background: isColActive ? "var(--moss-soft)" : undefined,
                      borderBottom: isColActive ? `3px solid ${meta.color}` : undefined,
                    }}
                    title={`Click to filter by ${meta.label} shift`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                      <span>{meta.icon}</span>
                      <span style={{ fontWeight: 600, color: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="muted" style={{ fontSize: "0.7rem", fontWeight: "normal" }}>
                      {meta.timeRange}
                    </div>
                  </th>
                );
              })}
              <th scope="col" style={{ textAlign: "center", minWidth: "100px" }}>
                Station Total
              </th>
            </tr>
          </thead>
          <tbody>
            {shiftShedMatrix.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }} className="muted">
                  No station records available.
                </td>
              </tr>
            ) : (
              shiftShedMatrix.map((row) => {
                const isRowSelected = selectedShedId === row.shedId;
                const shedLabel =
                  row.shedId === "unassigned"
                    ? "General / Staff"
                    : row.shedNumber.toLowerCase().includes("ac room")
                    ? "❄️ AC Room"
                    : row.shedNumber.toLowerCase().startsWith("shed")
                    ? row.shedNumber.replace("-", " ")
                    : `Shed ${row.shedNumber}`;

                return (
                  <tr
                    key={row.shedId}
                    style={{
                      background: isRowSelected ? "var(--surface-sunk)" : undefined,
                    }}
                  >
                    {/* Row Header: Shed info */}
                    <td
                      onClick={() => onSelectShed(row.shedId)}
                      style={{
                        cursor: "pointer",
                        fontWeight: 600,
                        borderLeft: isRowSelected ? "4px solid var(--moss)" : "4px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span>{shedLabel}</span>
                        {isRowSelected && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              background: "var(--moss)",
                              color: "#fff",
                              padding: "1px 5px",
                              borderRadius: "8px",
                            }}
                          >
                            Filtered
                          </span>
                        )}
                      </div>
                      {row.capacity != null && row.capacity > 0 && (
                        <div className="muted" style={{ fontSize: "0.7rem", fontWeight: "normal" }}>
                          {formatNumber(row.capacity)} birds
                        </div>
                      )}
                    </td>

                    {/* Shift Columns */}
                    {SHIFTS.map((shift) => {
                      const cell = row.byShift[shift];
                      const isCellSelected = selectedShedId === row.shedId && dashboardShift === shift;
                      const hasRecords = cell && cell.total > 0;
                      const present = cell?.present ?? 0;
                      const halfDay = cell?.halfDay ?? 0;
                      const absent = cell?.absent ?? 0;
                      const total = cell?.total ?? 0;
                      const isZeroDutyAlert = hasRecords && present === 0;
                      const rate = hasRecords ? Math.round(((present + halfDay) / total) * 100) : 0;

                      return (
                        <td
                          key={shift}
                          onClick={() => onSelectCell(row.shedId, shift)}
                          style={{
                            textAlign: "center",
                            cursor: "pointer",
                            padding: "0.4rem 0.5rem",
                            background: isCellSelected
                              ? "var(--moss-soft)"
                              : isZeroDutyAlert
                              ? "rgba(220, 38, 38, 0.08)"
                              : undefined,
                            outline: isCellSelected ? "2px solid var(--moss)" : undefined,
                            transition: "background 150ms ease",
                          }}
                          title={
                            hasRecords
                              ? `${shedLabel} · ${SHIFT_CONFIG[shift].label}: ${present} present, ${absent} absent (${rate}% turnout)`
                              : `Click to filter ${shedLabel} for ${SHIFT_CONFIG[shift].label}`
                          }
                        >
                          {hasRecords ? (
                            <div
                              style={{
                                display: "inline-flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "2px",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "var(--radius-sm, 4px)",
                                background: isZeroDutyAlert
                                  ? "var(--rust-soft, #fee2e2)"
                                  : rate >= 75
                                  ? "var(--moss-soft, #dcfce7)"
                                  : "var(--clay-soft, #ffedd5)",
                                border: `1px solid ${
                                  isZeroDutyAlert
                                    ? "var(--rust, #ef4444)"
                                    : rate >= 75
                                    ? "var(--moss, #22c55e)"
                                    : "var(--clay, #f97316)"
                                }`,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  color: isZeroDutyAlert
                                    ? "var(--rust, #b91c1c)"
                                    : rate >= 75
                                    ? "var(--moss, #15803d)"
                                    : "var(--clay, #c2410c)",
                                }}
                              >
                                {present > 0 ? `🟢 ${present}` : "🔴 0"}
                                {halfDay > 0 && (
                                  <span style={{ fontSize: "0.7rem", color: "var(--clay)" }}> +{halfDay}H</span>
                                )}
                              </span>
                              {absent > 0 && (
                                <span style={{ fontSize: "0.68rem", color: "var(--rust, #b91c1c)", fontWeight: 600 }}>
                                  {absent} absent
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Row Total */}
                    <td style={{ textAlign: "center", fontWeight: 700 }}>
                      {row.total.total > 0 ? (
                        <div>
                          <span style={{ color: row.total.present > 0 ? "var(--moss)" : "var(--rust)" }}>
                            {row.total.present}
                          </span>
                          <span className="muted" style={{ fontSize: "0.75rem", fontWeight: "normal" }}>
                            {" "}/ {row.total.total}
                          </span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {/* Table Footer: Column Totals */}
          {shiftShedMatrix.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--surface-sunk)", fontWeight: 700 }}>
                <td>Shift Grand Totals</td>
                {SHIFTS.map((s) => {
                  const shiftSum = shiftSummaries.find((sum) => sum.shift === s);
                  const totalPresent = (shiftSum?.present ?? 0) + (shiftSum?.halfDay ?? 0);
                  const totalMarked = shiftSum?.total ?? 0;
                  return (
                    <td key={s} style={{ textAlign: "center" }}>
                      {totalMarked > 0 ? (
                        <div>
                          <span style={{ color: "var(--moss)" }}>{totalPresent}</span>
                          <span className="muted" style={{ fontSize: "0.75rem", fontWeight: "normal" }}>
                            {" "}/ {totalMarked}
                          </span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", color: "var(--moss)" }}>
                  {metrics.totalPresent + metrics.halfDayCount} / {metrics.totalMarked}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}
    </Panel>
  );
}
