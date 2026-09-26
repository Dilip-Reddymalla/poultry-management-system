import type { Shift } from "../../api/types.js";
import { SHIFT_CONFIG, type AttendanceMetrics } from "./attendance-dashboard-types.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export function AttendanceKpiGrid({
  metrics,
  dashboardShift,
  scopedRecordsCount,
  totalActiveWorkforce,
  canApprove,
  bulkApproving,
  onApproveAllPending,
  onResetShift,
  isMobile: isMobileProp,
}: {
  metrics: AttendanceMetrics;
  dashboardShift: Shift | "";
  scopedRecordsCount: number;
  totalActiveWorkforce: number;
  canApprove: boolean;
  bulkApproving: boolean;
  onApproveAllPending: () => void;
  onResetShift: () => void;
  isMobile?: boolean;
}): React.ReactElement {
  const isMobile = isMobileProp ?? useIsMobile();

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Compact Shift Scope Chip for Mobile */}
        {dashboardShift && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.35rem 0.75rem",
              background: "var(--surface)",
              border: `1px solid ${SHIFT_CONFIG[dashboardShift].color}`,
              borderLeft: `4px solid ${SHIFT_CONFIG[dashboardShift].color}`,
              borderRadius: "var(--radius)",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span>{SHIFT_CONFIG[dashboardShift].icon}</span>
              <strong>{SHIFT_CONFIG[dashboardShift].label} Shift</strong>
              <span className="muted">({scopedRecordsCount} records)</span>
            </div>
            <button
              type="button"
              className="button button--ghost"
              style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", minHeight: "22px" }}
              onClick={onResetShift}
            >
              Reset ✕
            </button>
          </div>
        )}

        {/* Horizontal Scrolling KPI Chips */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            gap: "0.5rem",
            paddingBottom: "0.35rem",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Chip 1: Attendance Rate */}
          <div
            style={{
              flex: "0 0 130px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderTop: "3px solid var(--moss)",
              borderRadius: "var(--radius)",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "0.68rem" }}>Rate</span>
              <span style={{ fontSize: "0.9rem" }}>📈</span>
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--moss)", lineHeight: 1.1 }}>
              {metrics.attendanceRate}%
            </div>
            <div style={{ height: "4px", background: "var(--slate-soft)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${metrics.attendanceRate}%`,
                  height: "100%",
                  background: "var(--moss)",
                }}
              />
            </div>
            <span className="muted" style={{ fontSize: "0.68rem" }}>
              {metrics.totalPresent + metrics.halfDayCount}/{dashboardShift ? metrics.totalMarked : (totalActiveWorkforce || metrics.totalMarked)} marked
            </span>
          </div>

          {/* Chip 2: Present Today */}
          <div
            style={{
              flex: "0 0 130px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderTop: "3px solid var(--moss)",
              borderRadius: "var(--radius)",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "0.68rem" }}>Present</span>
              <span style={{ fontSize: "0.9rem" }}>🟢</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
                {metrics.totalPresent}
              </span>
              {metrics.halfDayCount > 0 && (
                <span style={{ fontSize: "0.72rem", color: "var(--clay)", fontWeight: 600 }}>
                  +{metrics.halfDayCount}H
                </span>
              )}
            </div>
            <span className="muted" style={{ fontSize: "0.68rem" }}>
              👔 {metrics.presentEmployees} · 🚜 {metrics.presentWorkers}
            </span>
          </div>

          {/* Chip 3: Absences & Leaves */}
          <div
            style={{
              flex: "0 0 130px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderTop: "3px solid var(--rust)",
              borderRadius: "var(--radius)",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "0.68rem" }}>Absences</span>
              <span style={{ fontSize: "0.9rem" }}>🔴</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--rust)", lineHeight: 1.1 }}>
                {metrics.absentCount}
              </span>
              {metrics.leaveCount > 0 && (
                <span style={{ fontSize: "0.72rem", color: "var(--clay)", fontWeight: 600 }}>
                  · {metrics.leaveCount}L
                </span>
              )}
            </div>
            <span className="muted" style={{ fontSize: "0.68rem" }}>
              {metrics.absentCount + metrics.leaveCount} unplanned
            </span>
          </div>

          {/* Chip 4: Face AI */}
          <div
            style={{
              flex: "0 0 130px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderTop: "3px solid #1f4d8f",
              borderRadius: "var(--radius)",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "0.68rem" }}>Face AI</span>
              <span style={{ fontSize: "0.9rem" }}>📸</span>
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#1f4d8f", lineHeight: 1.1 }}>
              {metrics.faceAiCount}
            </div>
            <span className="muted" style={{ fontSize: "0.68rem" }}>
              {metrics.avgConfidence ? `${metrics.avgConfidence}% avg match` : "Manual / GPS"}
            </span>
          </div>

          {/* Chip 5: Pending Signoffs */}
          <div
            style={{
              flex: "0 0 135px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderTop: `3px solid ${metrics.pendingApprovalCount > 0 ? "var(--clay)" : "var(--moss)"}`,
              borderRadius: "var(--radius)",
              padding: "0.5rem 0.65rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="eyebrow" style={{ fontSize: "0.68rem" }}>Pending</span>
              <span style={{ fontSize: "0.9rem" }}>✍️</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: 700, color: metrics.pendingApprovalCount > 0 ? "var(--clay)" : "var(--moss)", lineHeight: 1.1 }}>
                {metrics.pendingApprovalCount}
              </span>
              {metrics.pendingApprovalCount > 0 && canApprove && (
                <button
                  type="button"
                  className="button button--secondary"
                  style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem", minHeight: "22px" }}
                  onClick={onApproveAllPending}
                  disabled={bulkApproving}
                >
                  {bulkApproving ? "..." : "Approve"}
                </button>
              )}
            </div>
            <span className="muted" style={{ fontSize: "0.68rem" }}>
              {metrics.pendingApprovalCount === 0 ? "All signed off" : "Awaiting review"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      {/* Shift Scope Banner */}
      {dashboardShift && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.6rem 1rem",
            background: "var(--surface)",
            border: `1px solid ${SHIFT_CONFIG[dashboardShift].color}`,
            borderLeft: `5px solid ${SHIFT_CONFIG[dashboardShift].color}`,
            borderRadius: "var(--radius)",
            fontSize: "0.88rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.2rem" }}>{SHIFT_CONFIG[dashboardShift].icon}</span>
            <span>
              Viewing <strong>{SHIFT_CONFIG[dashboardShift].label} Shift</strong> ({SHIFT_CONFIG[dashboardShift].timeRange}) —{" "}
              <strong>{scopedRecordsCount}</strong> records marked
            </span>
          </div>
          <button
            type="button"
            className="button button--ghost"
            style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }}
            onClick={onResetShift}
          >
            Show All Shifts ✕
          </button>
        </div>
      )}

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
