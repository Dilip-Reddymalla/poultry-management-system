import type { Shift } from "../../api/types.js";
import { SHIFT_CONFIG, type AttendanceMetrics } from "./attendance-dashboard-types.js";

export function AttendanceKpiGrid({
  metrics,
  dashboardShift,
  scopedRecordsCount,
  totalActiveWorkforce,
  canApprove,
  bulkApproving,
  onApproveAllPending,
  onResetShift,
}: {
  metrics: AttendanceMetrics;
  dashboardShift: Shift | "";
  scopedRecordsCount: number;
  totalActiveWorkforce: number;
  canApprove: boolean;
  bulkApproving: boolean;
  onApproveAllPending: () => void;
  onResetShift: () => void;
}): React.ReactElement {
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      {/* Shift Scope Banner Indicator */}
      {dashboardShift && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            padding: "0.75rem 1.25rem",
            background: "var(--surface)",
            border: `1px solid ${SHIFT_CONFIG[dashboardShift].color}`,
            borderLeft: `5px solid ${SHIFT_CONFIG[dashboardShift].color}`,
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <span style={{ fontSize: "1.4rem" }}>{SHIFT_CONFIG[dashboardShift].icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ink)" }}>
                Viewing {SHIFT_CONFIG[dashboardShift].label} Shift ({SHIFT_CONFIG[dashboardShift].timeRange})
              </div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                All KPI cards, shed counts, and roster records below are scoped to this shift ({scopedRecordsCount} records marked).
              </div>
            </div>
          </div>
          <button
            type="button"
            className="button button--secondary"
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem", minHeight: "28px" }}
            onClick={onResetShift}
          >
            Reset to All Shifts ✕
          </button>
        </div>
      )}

      {/* KPI Overview Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Card 1: Attendance Rate */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderTop: "3px solid var(--moss)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: "var(--ink-soft)" }}>
              {dashboardShift ? `${SHIFT_CONFIG[dashboardShift].label} Attendance` : "Attendance Rate"}
            </span>
            <span style={{ fontSize: "1.1rem" }}>📈</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--moss)", lineHeight: 1 }}>
              {metrics.attendanceRate}%
            </span>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              {dashboardShift ? "shift turnout" : "of active workforce"}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: "6px", background: "var(--slate-soft)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${metrics.attendanceRate}%`,
                height: "100%",
                background: "var(--moss)",
                transition: "width 300ms ease",
              }}
            />
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            <strong>{metrics.totalPresent + metrics.halfDayCount}</strong> / {dashboardShift ? metrics.totalMarked : (totalActiveWorkforce || metrics.totalMarked)} workers marked
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderTop: "3px solid var(--moss)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: "var(--ink-soft)" }}>Present On Duty</span>
            <span style={{ fontSize: "1.1rem" }}>🟢</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>
              {metrics.totalPresent}
            </span>
            {metrics.halfDayCount > 0 && (
              <span style={{ fontSize: "0.85rem", color: "var(--clay)", fontWeight: 600 }}>
                +{metrics.halfDayCount} Half-day
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            <span>👔 Employees: <strong>{metrics.presentEmployees}</strong></span>
            <span>🚜 Workers: <strong>{metrics.presentWorkers}</strong></span>
          </div>
        </div>

        {/* Card 3: Absences & Leaves */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderTop: "3px solid var(--rust)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: "var(--ink-soft)" }}>Absences & Leaves</span>
            <span style={{ fontSize: "1.1rem" }}>🔴</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--rust)", lineHeight: 1 }}>
              {metrics.absentCount}
            </span>
            <span className="muted" style={{ fontSize: "0.85rem" }}>Absent</span>
            {metrics.leaveCount > 0 && (
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--clay)" }}>
                · {metrics.leaveCount} On Leave
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            Total unplanned variance: <strong>{metrics.absentCount + metrics.leaveCount}</strong>
          </div>
        </div>

        {/* Card 4: Face AI Verified */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderTop: "3px solid #1f4d8f",
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: "var(--ink-soft)" }}>Face AI Verification</span>
            <span style={{ fontSize: "1.1rem" }}>📸</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "#1f4d8f", lineHeight: 1 }}>
              {metrics.faceAiCount}
            </span>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {metrics.totalMarked > 0 ? `(${Math.round((metrics.faceAiCount / metrics.totalMarked) * 100)}%)` : ""}
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {metrics.avgConfidence ? (
              <span>Avg Confidence: <strong style={{ color: "var(--moss)" }}>{metrics.avgConfidence}% match</strong></span>
            ) : (
              <span>Manual / GPS fallback used</span>
            )}
          </div>
        </div>

        {/* Card 5: Pending Signoffs */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderTop: `3px solid ${metrics.pendingApprovalCount > 0 ? "var(--clay)" : "var(--moss)"}`,
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow" style={{ color: "var(--ink-soft)" }}>Manager Approvals</span>
            <span style={{ fontSize: "1.1rem" }}>✍️</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
              <span style={{ fontSize: "2rem", fontWeight: 700, color: metrics.pendingApprovalCount > 0 ? "var(--clay)" : "var(--moss)", lineHeight: 1 }}>
                {metrics.pendingApprovalCount}
              </span>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Pending</span>
            </div>
            {metrics.pendingApprovalCount > 0 && canApprove && (
              <button
                type="button"
                className="button button--secondary"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", minHeight: "26px" }}
                onClick={onApproveAllPending}
                disabled={bulkApproving}
              >
                {bulkApproving ? "Approving..." : "Approve All"}
              </button>
            )}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {metrics.pendingApprovalCount === 0 ? "✓ All records approved" : "Awaiting supervisor/manager signoff"}
          </div>
        </div>
      </div>
    </div>
  );
}
