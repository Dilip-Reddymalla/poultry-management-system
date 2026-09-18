import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/use-auth.js";
import {
  fetchAttendance,
  fetchSheds,
  fetchEmployees,
  fetchWorkers,
  fetchFarms,
  approveAttendance,
  type AttendanceListResponse,
  type EmployeeListResponse,
  type WorkerListResponse,
} from "../../api/resources.js";
import type { Shift, Shed, Attendance, Farm } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { useResource } from "../../hooks/useResource.js";
import { useToast } from "../../components/use-toast.js";
import { statusLabel, todayInputValue, formatDate, formatNumber } from "../../lib/display.js";
import { EmptyState, Panel, StatusTag, Button } from "../../components/ui.js";
import { AttendanceEntryDialog } from "./AttendanceEntryDialog.js";
import { BulkAttendanceDialog } from "./BulkAttendanceDialog.js";
import { ExportAttendanceDialog } from "./ExportAttendanceDialog.js";
import { MarkUnmarkedAbsentDialog } from "./MarkUnmarkedAbsentDialog.js";

interface ShiftSummaryData {
  shift: Shift;
  label: string;
  total: number;
  present: number;
  halfDay: number;
  absent: number;
  leave: number;
}

interface ShedSummaryItem {
  shedId: string;
  shedNumber: string;
  capacity?: number | undefined;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  total: number;
}

export function AttendanceDashboardPage(): React.ReactElement {
  const { user, can } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [date, setDate] = useState(todayInputValue());
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [selectedShedId, setSelectedShedId] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<Shift | "">("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "FACE_AI" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [snapshotPreview, setSnapshotPreview] = useState<{ url: string; name: string; score?: number | null | undefined } | null>(null);

  // Dialog triggers
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showUnmarkedAbsentDialog, setShowUnmarkedAbsentDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const showFarmFilter = user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";
  const isSupervisor = user?.role === "SUPERVISOR" || (user?.roles && user.roles.includes("SUPERVISOR"));

  // Fetch Farms if user has multi-farm view
  const farms = useResource<Farm[]>(
    "farms:dashboard-picker",
    () => fetchFarms(),
    { enabled: showFarmFilter }
  );
  const farmList = farms.data ?? [];

  // Fetch Sheds
  const sheds = useResource<Shed[]>(
    `sheds:dashboard-picker:${selectedFarmId}`,
    (signal) => fetchSheds(selectedFarmId ? { farmId: selectedFarmId } : {}, signal)
  );
  const shedList = sheds.data ?? [];

  // Fetch Total Active Workforce for denominator / coverage metrics
  const employees = useResource<EmployeeListResponse>(
    `employees:dashboard-count:${selectedFarmId}`,
    (signal) => fetchEmployees({ status: "ACTIVE", limit: 1000, ...(selectedFarmId ? { farmId: selectedFarmId } : {}) }, signal)
  );
  const workers = useResource<WorkerListResponse>(
    `workers:dashboard-count:${selectedFarmId}`,
    (signal) => fetchWorkers({ status: "ACTIVE", limit: 1000, ...(selectedFarmId ? { farmId: selectedFarmId } : {}) }, signal)
  );

  const totalActiveEmployees = employees.data?.employees?.length ?? 0;
  const totalActiveWorkers = workers.data?.workers?.length ?? 0;
  const totalActiveWorkforce = totalActiveEmployees + totalActiveWorkers;

  // Attendance Query for selected date
  const query = {
    page: 1,
    limit: 1000,
    date,
    ...(selectedFarmId ? { farmId: selectedFarmId } : {}),
    ...(isSupervisor && user?.id ? { recordedById: user.id } : {}),
  };

  const attendanceResource = useResource<AttendanceListResponse>(
    `attendance-dashboard:${JSON.stringify(query)}`,
    (signal) => fetchAttendance(query, signal)
  );

  const records: Attendance[] = attendanceResource.data?.attendance ?? [];

  // Date Navigation Helpers
  const shiftDate = (offsetDays: number) => {
    const current = new Date(date);
    if (isNaN(current.getTime())) return;
    current.setDate(current.getDate() + offsetDays);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  };

  const isToday = date === todayInputValue();

  // Metrics Calculations
  const metrics = useMemo(() => {
    let presentEmployees = 0;
    let presentWorkers = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let faceAiCount = 0;
    let faceAiConfidenceSum = 0;
    let pendingApprovalCount = 0;

    for (const r of records) {
      if (r.status === "PRESENT") {
        if (r.person.type === "EMPLOYEE") presentEmployees++;
        else presentWorkers++;
      } else if (r.status === "HALF_DAY") {
        halfDayCount++;
      } else if (r.status === "ABSENT") {
        absentCount++;
      } else if (r.status === "LEAVE") {
        leaveCount++;
      }

      if (r.verificationMode === "FACE_AI") {
        faceAiCount++;
        if (r.confidenceScore != null) {
          faceAiConfidenceSum += r.confidenceScore;
        }
      }

      if (!r.approvedAt) {
        pendingApprovalCount++;
      }
    }

    const totalPresentAndHalf = presentEmployees + presentWorkers + halfDayCount;
    const denominator = totalActiveWorkforce > 0 ? totalActiveWorkforce : records.length || 1;
    const attendanceRate = Math.min(100, Math.round((totalPresentAndHalf / denominator) * 100));
    const avgConfidence = faceAiCount > 0 ? Math.round(faceAiConfidenceSum / faceAiCount) : null;

    return {
      presentEmployees,
      presentWorkers,
      totalPresent: presentEmployees + presentWorkers,
      halfDayCount,
      absentCount,
      leaveCount,
      faceAiCount,
      avgConfidence,
      pendingApprovalCount,
      attendanceRate,
      totalMarked: records.length,
    };
  }, [records, totalActiveWorkforce]);

  // Shift Breakdown
  const shiftSummaries = useMemo<ShiftSummaryData[]>(() => {
    const map = new Map<Shift, ShiftSummaryData>();
    for (const s of SHIFTS) {
      map.set(s, {
        shift: s,
        label: statusLabel(s),
        total: 0,
        present: 0,
        halfDay: 0,
        absent: 0,
        leave: 0,
      });
    }

    for (const r of records) {
      const summary = map.get(r.shift);
      if (summary) {
        summary.total++;
        if (r.status === "PRESENT") summary.present++;
        else if (r.status === "HALF_DAY") summary.halfDay++;
        else if (r.status === "ABSENT") summary.absent++;
        else if (r.status === "LEAVE") summary.leave++;
      }
    }

    return Array.from(map.values());
  }, [records]);

  // Shed Breakdown
  const shedSummaries = useMemo<ShedSummaryItem[]>(() => {
    const map = new Map<string, ShedSummaryItem>();

    // Seed from shed list
    for (const s of shedList) {
      map.set(s.id, {
        shedId: s.id,
        shedNumber: s.number,
        capacity: s.capacity,
        present: 0,
        absent: 0,
        halfDay: 0,
        leave: 0,
        total: 0,
      });
    }

    // Seed unassigned
    map.set("unassigned", {
      shedId: "unassigned",
      shedNumber: "General / Staff",
      capacity: undefined,
      present: 0,
      absent: 0,
      halfDay: 0,
      leave: 0,
      total: 0,
    });

    for (const r of records) {
      const shedKey = r.shed?.id || "unassigned";
      let item = map.get(shedKey);
      if (!item) {
        item = {
          shedId: shedKey,
          shedNumber: r.shed?.number ?? "Other",
          capacity: r.shed?.capacity,
          present: 0,
          absent: 0,
          halfDay: 0,
          leave: 0,
          total: 0,
        };
        map.set(shedKey, item);
      }
      item.total++;
      if (r.status === "PRESENT") item.present++;
      else if (r.status === "HALF_DAY") item.halfDay++;
      else if (r.status === "ABSENT") item.absent++;
      else if (r.status === "LEAVE") item.leave++;
    }

    return Array.from(map.values()).filter(s => s.total > 0 || shedList.some(sh => sh.id === s.shedId));
  }, [records, shedList]);

  // Filtered Roster Table
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Shed Filter
      if (selectedShedId === "unassigned") {
        if (r.shedId) return false;
      } else if (selectedShedId && r.shedId !== selectedShedId) {
        return false;
      }

      // Shift Filter
      if (selectedShift && r.shift !== selectedShift) {
        return false;
      }

      // Tab Status Filter
      if (activeTab === "PRESENT" && r.status !== "PRESENT") return false;
      if (activeTab === "ABSENT" && r.status !== "ABSENT") return false;
      if (activeTab === "HALF_DAY" && r.status !== "HALF_DAY") return false;
      if (activeTab === "LEAVE" && r.status !== "LEAVE") return false;
      if (activeTab === "FACE_AI" && r.verificationMode !== "FACE_AI") return false;
      if (activeTab === "PENDING" && r.approvedAt != null) return false;

      // Text Search
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchName = r.person.name.toLowerCase().includes(q);
        const matchCode = r.person.code.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q) ?? false;
        const matchShed = r.shed?.number?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchCode && !matchNotes && !matchShed) return false;
      }

      return true;
    });
  }, [records, selectedShedId, selectedShift, activeTab, searchQuery]);

  // Approval Handlers
  const handleApproveSingle = async (recordId: string) => {
    try {
      setApprovingId(recordId);
      await approveAttendance(recordId);
      notify("success", "Attendance record approved.");
      attendanceResource.reload();
    } catch (err: any) {
      notify("error", err?.message || "Failed to approve record.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAllPending = async () => {
    const pending = records.filter(r => !r.approvedAt);
    if (pending.length === 0) return;
    if (!window.confirm(`Are you sure you want to approve all ${pending.length} pending attendance records for ${date}?`)) {
      return;
    }

    setBulkApproving(true);
    let successCount = 0;
    for (const r of pending) {
      try {
        await approveAttendance(r.id);
        successCount++;
      } catch {
        // continue best effort
      }
    }
    setBulkApproving(false);
    notify("success", `Approved ${successCount} attendance records.`);
    attendanceResource.reload();
  };

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      {/* Header & Primary Controls */}
      <PageHeader
        eyebrow="Workforce Operations"
        title="Attendance Command Center"
        description={`Real-time shift rosters, face AI verification status, and shed allocations.`}
        actions={
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="primary"
              onClick={() => navigate("/attendance/face")}
              style={{ backgroundColor: "var(--moss)", borderColor: "var(--moss)", color: "#ffffff" }}
            >
              🤖 Face AI Scanner
            </Button>
            {can("attendance:create") && (
              <>
                <Button variant="secondary" onClick={() => setShowBulkDialog(true)}>
                  📋 Bulk Mark
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowUnmarkedAbsentDialog(true)}
                  style={{ color: "var(--rust, #b91c1c)" }}
                  title="Mark all unmarked personnel as absent for this shift"
                >
                  ⚠️ Mark Unmarked Absent
                </Button>
                <Button variant="secondary" onClick={() => setShowEntryDialog(true)}>
                  ➕ Mark Single
                </Button>
              </>
            )}
            {can("report:export") && (
              <Button variant="secondary" onClick={() => setShowExportDialog(true)}>
                📊 Export Excel
              </Button>
            )}
            <Link to="/attendance" className="button button--ghost" title="Detailed Roster Search">
              Full Log ↗
            </Link>
          </div>
        }
      />

      {/* Date Navigation & Scope Command Bar */}
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
              onClick={() => shiftDate(-1)}
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
              onClick={() => setDate(todayInputValue())}
            >
              {isToday ? "● Today" : "Today"}
            </button>
            <button
              type="button"
              className="button button--ghost"
              style={{ padding: "0.35rem 0.65rem", minHeight: "32px", fontSize: "0.85rem" }}
              onClick={() => shiftDate(1)}
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
            onChange={(e) => setDate(e.target.value)}
          />

          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)" }}>
            {formatDate(date)}
          </span>
        </div>

        {/* Right: Farm Filter & Quick Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {showFarmFilter && farmList.length > 0 && (
            <select
              className="input select"
              style={{ width: "200px", padding: "0.35rem 0.65rem", fontSize: "0.875rem" }}
              value={selectedFarmId}
              onChange={(e) => {
                setSelectedFarmId(e.target.value);
                setSelectedShedId("");
              }}
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
            onClick={() => attendanceResource.reload()}
            title="Refresh Attendance Data"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

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
            <span className="eyebrow" style={{ color: "var(--ink-soft)" }}>Attendance Rate</span>
            <span style={{ fontSize: "1.1rem" }}>📈</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--moss)", lineHeight: 1 }}>
              {metrics.attendanceRate}%
            </span>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              of active workforce
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
            <strong>{metrics.totalPresent + metrics.halfDayCount}</strong> / {totalActiveWorkforce || metrics.totalMarked} registered workers
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
            {metrics.pendingApprovalCount > 0 && can("attendance:approve") && (
              <button
                type="button"
                className="button button--secondary"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", minHeight: "26px" }}
                onClick={handleApproveAllPending}
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

      {/* Interactive Shift Allocation & Shed Workforce Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Shifts Matrix */}
        <Panel
          title="Shift Distribution"
          eyebrow="Operational Shifts"
          actions={
            selectedShift !== "" ? (
              <button
                type="button"
                className="button button--ghost"
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }}
                onClick={() => setSelectedShift("")}
              >
                Clear Filter ✕
              </button>
            ) : null
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {shiftSummaries.map((s) => {
              const isSelected = selectedShift === s.shift;
              const hasData = s.total > 0;
              const presentPct = hasData ? Math.round(((s.present + s.halfDay) / s.total) * 100) : 0;

              return (
                <div
                  key={s.shift}
                  onClick={() => setSelectedShift(isSelected ? "" : s.shift)}
                  style={{
                    padding: "0.85rem",
                    border: `1px solid ${isSelected ? "var(--moss)" : "var(--line)"}`,
                    borderRadius: "var(--radius)",
                    background: isSelected ? "var(--moss-soft)" : "var(--surface-sunk)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{s.label}</span>
                      {isSelected && (
                        <span style={{ fontSize: "0.7rem", background: "var(--moss)", color: "#fff", padding: "1px 6px", borderRadius: "10px" }}>
                          Active Filter
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {s.total} marked {hasData ? `(${presentPct}% present)` : ""}
                    </span>
                  </div>

                  {/* Multi-color Stacked Progress Bar */}
                  {hasData ? (
                    <>
                      <div style={{ height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${(s.present / s.total) * 100}%`, background: "var(--moss)" }} title={`Present: ${s.present}`} />
                        <div style={{ width: `${(s.halfDay / s.total) * 100}%`, background: "var(--clay)" }} title={`Half Day: ${s.halfDay}`} />
                        <div style={{ width: `${(s.leave / s.total) * 100}%`, background: "#7b8a82" }} title={`Leave: ${s.leave}`} />
                        <div style={{ width: `${(s.absent / s.total) * 100}%`, background: "var(--rust)" }} title={`Absent: ${s.absent}`} />
                      </div>
                      <div style={{ display: "flex", gap: "0.85rem", marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                        <span>🟢 Present: <strong>{s.present}</strong></span>
                        {s.halfDay > 0 && <span>🟠 Half: <strong>{s.halfDay}</strong></span>}
                        {s.leave > 0 && <span>⚪ Leave: <strong>{s.leave}</strong></span>}
                        <span>🔴 Absent: <strong>{s.absent}</strong></span>
                      </div>
                    </>
                  ) : (
                    <div className="muted" style={{ fontSize: "0.78rem" }}>No attendance recorded for this shift yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Shed Allocation Matrix */}
        <Panel
          title="Shed Workforce Matrix"
          eyebrow="Station Distribution"
          actions={
            selectedShedId !== "" ? (
              <button
                type="button"
                className="button button--ghost"
                style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }}
                onClick={() => setSelectedShedId("")}
              >
                Clear Filter ✕
              </button>
            ) : null
          }
        >
          {shedSummaries.length === 0 ? (
            <div className="muted" style={{ textAlign: "center", padding: "2rem" }}>No sheds configured.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {shedSummaries.map((s) => {
                const isSelected = selectedShedId === s.shedId;
                const isWarning = s.shedId !== "unassigned" && s.present === 0;

                return (
                  <div
                    key={s.shedId}
                    onClick={() => setSelectedShedId(isSelected ? "" : s.shedId)}
                    style={{
                      padding: "0.75rem 0.6rem",
                      border: `1px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--line)"}`,
                      borderTop: `3px solid ${isSelected ? "var(--moss)" : isWarning ? "var(--rust)" : "var(--ink-soft)"}`,
                      borderRadius: "var(--radius)",
                      background: isSelected ? "var(--moss-soft)" : "var(--surface)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      textAlign: "center",
                      transition: "transform 100ms ease, border-color 150ms ease",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                      {s.shedId === "unassigned" ? "General / Staff" : `Shed ${s.shedNumber}`}
                    </div>
                    {s.capacity != null && (
                      <div className="muted" style={{ fontSize: "0.68rem" }}>
                        {formatNumber(s.capacity)} birds
                      </div>
                    )}
                    <div style={{ marginTop: "0.25rem", fontSize: "1.2rem", fontWeight: 700, color: s.present > 0 ? "var(--moss)" : "var(--rust)" }}>
                      {s.present} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-soft)" }}>on duty</span>
                    </div>
                    {s.absent > 0 && (
                      <div style={{ fontSize: "0.7rem", color: "var(--rust)" }}>
                        {s.absent} absent
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Smart Roster Table & Inspection Area */}
      <Panel bleed>
        {/* Table Filters & Tab Row */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--line)", background: "var(--surface-sunk)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            {/* Status Filter Tabs */}
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`button ${activeTab === "ALL" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("ALL")}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                className={`button ${activeTab === "PRESENT" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("PRESENT")}
              >
                🟢 Present ({metrics.totalPresent})
              </button>
              <button
                type="button"
                className={`button ${activeTab === "HALF_DAY" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("HALF_DAY")}
              >
                🟠 Half-Day ({metrics.halfDayCount})
              </button>
              <button
                type="button"
                className={`button ${activeTab === "ABSENT" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("ABSENT")}
              >
                🔴 Absent ({metrics.absentCount})
              </button>
              <button
                type="button"
                className={`button ${activeTab === "LEAVE" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("LEAVE")}
              >
                ⚪ Leave ({metrics.leaveCount})
              </button>
              <button
                type="button"
                className={`button ${activeTab === "FACE_AI" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("FACE_AI")}
              >
                🤖 Face AI ({metrics.faceAiCount})
              </button>
              <button
                type="button"
                className={`button ${activeTab === "PENDING" ? "button--primary" : "button--ghost"}`}
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", minHeight: "28px" }}
                onClick={() => setActiveTab("PENDING")}
              >
                ✍️ Pending Approvals ({metrics.pendingApprovalCount})
              </button>
            </div>

            {/* Quick Search */}
            <div style={{ minWidth: "220px", flex: "0 1 280px" }}>
              <input
                type="text"
                className="input"
                placeholder="Filter by name, code, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", width: "100%" }}
              />
            </div>
          </div>

          {/* Active Context Filter Indicators */}
          {(selectedShedId || selectedShift) && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem", fontSize: "0.8rem" }}>
              <span className="muted">Filtered by:</span>
              {selectedShedId && (
                <span className="tag" style={{ background: "var(--paper)", fontSize: "0.75rem" }}>
                  Shed: {selectedShedId === "unassigned" ? "General / Staff" : shedList.find(s => s.id === selectedShedId)?.number ? `Shed ${shedList.find(s => s.id === selectedShedId)?.number}` : selectedShedId}
                  <button type="button" onClick={() => setSelectedShedId("")} style={{ border: "none", background: "transparent", cursor: "pointer", marginLeft: "4px" }}>✕</button>
                </span>
              )}
              {selectedShift && (
                <span className="tag" style={{ background: "var(--paper)", fontSize: "0.75rem" }}>
                  Shift: {statusLabel(selectedShift)}
                  <button type="button" onClick={() => setSelectedShift("")} style={{ border: "none", background: "transparent", cursor: "pointer", marginLeft: "4px" }}>✕</button>
                </span>
              )}
              <button
                type="button"
                className="button button--ghost"
                style={{ padding: "1px 6px", fontSize: "0.75rem", minHeight: "20px" }}
                onClick={() => {
                  setSelectedShedId("");
                  setSelectedShift("");
                }}
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {/* Table Content */}
        {attendanceResource.loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-soft)" }}>
            Loading attendance records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title="No matching attendance records"
              description={`No records found for ${formatDate(date)} with the selected filters.`}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActiveTab("ALL");
                    setSelectedShedId("");
                    setSelectedShift("");
                    setSearchQuery("");
                  }}
                >
                  Clear Filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Person & Role</th>
                  <th scope="col">Station / Shed</th>
                  <th scope="col">Shift</th>
                  <th scope="col">Status</th>
                  <th scope="col">Verification Method</th>
                  <th scope="col">Recorded Time & By</th>
                  <th scope="col">Approval</th>
                  <th scope="col" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const isPending = !record.approvedAt;
                  const isFaceAi = record.verificationMode === "FACE_AI";

                  return (
                    <tr key={record.id}>
                      {/* Person */}
                      <td data-label="Person">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: record.person.type === "EMPLOYEE" ? "var(--ink)" : "var(--moss)",
                              color: "var(--paper)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {record.person.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <Link className="table__link" to={`/attendance/${record.id}`}>
                              {record.person.name}
                            </Link>
                            <span className="table__sub numeric">
                              {record.person.type === "EMPLOYEE" ? "👔 Employee" : "🚜 Worker"} · {record.person.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Station / Shed */}
                      <td data-label="Shed">
                        {record.shed?.number ? (
                          <span className="tag" style={{ background: "var(--surface-sunk)", fontWeight: 600 }}>
                            Shed {record.shed.number}
                          </span>
                        ) : (
                          <span className="muted">General / Staff</span>
                        )}
                      </td>

                      {/* Shift */}
                      <td data-label="Shift">
                        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                          {statusLabel(record.shift)}
                        </span>
                      </td>

                      {/* Status */}
                      <td data-label="Status">
                        <StatusTag status={record.status} />
                      </td>

                      {/* Verification Method */}
                      <td data-label="Verification">
                        {isFaceAi ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                            <span
                              className="tag"
                              style={{
                                background: "#e8f0fe",
                                borderColor: "#c2d7ff",
                                color: "#1f4d8f",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              📸 Face AI {record.confidenceScore ? `(${Math.round(record.confidenceScore)}%)` : ""}
                            </span>
                            {record.snapshotUrl && (
                              <button
                                type="button"
                                className="button button--ghost"
                                style={{ padding: "1px 4px", fontSize: "0.7rem", minHeight: "20px" }}
                                onClick={() => setSnapshotPreview({
                                  url: record.snapshotUrl!,
                                  name: record.person.name,
                                  score: record.confidenceScore,
                                })}
                                title="View Face Snapshot"
                              >
                                🔍 Photo
                              </button>
                            )}
                          </div>
                        ) : record.latitude != null && record.longitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "0.8rem", textDecoration: "none", color: "var(--ink-soft)" }}
                            title={`GPS Coordinates: ${record.latitude}, ${record.longitude}`}
                          >
                            📍 GPS Location ↗
                          </a>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.8rem" }}>✍️ Manual Entry</span>
                        )}
                      </td>

                      {/* Time & Recorded By */}
                      <td data-label="Recorded By">
                        <div style={{ fontSize: "0.85rem" }}>
                          {record.createdAt ? new Date(record.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </div>
                        {record.recordedBy?.name && (
                          <span className="table__sub">by {record.recordedBy.name}</span>
                        )}
                      </td>

                      {/* Approval Status */}
                      <td data-label="Approval">
                        {isPending ? (
                          can("attendance:approve") ? (
                            <button
                              type="button"
                              className="button button--secondary"
                              style={{
                                padding: "0.2rem 0.55rem",
                                fontSize: "0.75rem",
                                minHeight: "26px",
                                borderColor: "var(--clay)",
                                color: "var(--clay)",
                              }}
                              disabled={approvingId === record.id}
                              onClick={() => handleApproveSingle(record.id)}
                            >
                              {approvingId === record.id ? "Approving..." : "✓ Approve"}
                            </button>
                          ) : (
                            <span className="tag" style={{ background: "var(--clay-soft)", color: "var(--clay)" }}>
                              Pending
                            </span>
                          )
                        ) : (
                          <span className="tag" style={{ background: "var(--moss-soft)", color: "var(--moss)" }} title={record.approvedBy?.name ? `Approved by ${record.approvedBy.name}` : undefined}>
                            ✓ Approved
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td data-label="Actions" style={{ textAlign: "right" }}>
                        <Link
                          to={`/attendance/${record.id}`}
                          className="button button--ghost"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem", minHeight: "26px" }}
                        >
                          Details ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Snapshot Preview Modal */}
      {snapshotPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setSnapshotPreview(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "var(--shadow-md)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 id="snapshot-modal-title" style={{ fontSize: "1.1rem", margin: 0 }}>
                Face Verification Snapshot
              </h3>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setSnapshotPreview(null)}
                style={{ padding: "0.2rem 0.5rem", minHeight: "28px" }}
              >
                ✕
              </button>
            </div>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <img
                src={snapshotPreview.url}
                alt={`Face snapshot of ${snapshotPreview.name}`}
                style={{
                  width: "100%",
                  maxHeight: "320px",
                  objectFit: "cover",
                  borderRadius: "var(--radius)",
                  border: "2px solid var(--line)",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
              <span><strong>Person:</strong> {snapshotPreview.name}</span>
              {snapshotPreview.score != null && (
                <span style={{ color: "var(--moss)", fontWeight: 600 }}>
                  Confidence: {Math.round(snapshotPreview.score)}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entry Dialogs */}
      {showEntryDialog && (
        <AttendanceEntryDialog
          defaultDate={date}
          defaultFarmId={selectedFarmId || null}
          onClose={() => setShowEntryDialog(false)}
          onSaved={() => {
            setShowEntryDialog(false);
            notify("success", "Attendance recorded.");
            attendanceResource.reload();
          }}
        />
      )}

      {showBulkDialog && (
        <BulkAttendanceDialog
          defaultDate={date}
          defaultFarmId={selectedFarmId || null}
          onClose={() => setShowBulkDialog(false)}
          onSaved={() => {
            setShowBulkDialog(false);
            notify("success", "Bulk attendance recorded.");
            attendanceResource.reload();
          }}
        />
      )}

      {showUnmarkedAbsentDialog && (
        <MarkUnmarkedAbsentDialog
          defaultDate={date}
          defaultFarmId={selectedFarmId || null}
          defaultShift={selectedShift || "MORNING_SHIFT"}
          onClose={() => setShowUnmarkedAbsentDialog(false)}
          onSaved={() => {
            setShowUnmarkedAbsentDialog(false);
            attendanceResource.reload();
          }}
        />
      )}

      {showExportDialog && (
        <ExportAttendanceDialog
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}
