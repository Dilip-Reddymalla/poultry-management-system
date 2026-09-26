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
import { statusLabel, todayInputValue } from "../../lib/display.js";
import { Button } from "../../components/ui.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

// Extracted Subcomponents & Types
import { AttendanceAvatar } from "./AttendanceAvatar.js";
import { SnapshotPreviewModal } from "./SnapshotPreviewModal.js";
import { AttendanceCommandBar } from "./AttendanceCommandBar.js";
import { AttendanceKpiGrid } from "./AttendanceKpiGrid.js";
import { ShiftPerformanceTable } from "./ShiftPerformanceTable.js";
import { ShedWorkforceCards } from "./ShedWorkforceCards.js";
import { ShiftShedMatrixTable } from "./ShiftShedMatrixTable.js";
import { AttendanceRosterTable } from "./AttendanceRosterTable.js";
import {
  type ShiftSummaryData,
  type ShedSummaryItem,
  type ShiftShedCell,
  type ShiftShedRow,
  type AttendanceMetrics,
  type SnapshotPreviewData,
} from "./attendance-dashboard-types.js";

// Dialogs
import { AttendanceEntryDialog } from "./AttendanceEntryDialog.js";
import { BulkAttendanceDialog } from "./BulkAttendanceDialog.js";
import { ExportAttendanceDialog } from "./ExportAttendanceDialog.js";
import { MarkUnmarkedAbsentDialog } from "./MarkUnmarkedAbsentDialog.js";

// Re-export AttendanceAvatar and types for backward-compatibility with other files
export { AttendanceAvatar };
export type { ShiftSummaryData, ShedSummaryItem, ShiftShedCell, ShiftShedRow };

export function AttendanceDashboardPage(): React.ReactElement {
  const { user, can } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  // Primary State
  const [date, setDate] = useState(todayInputValue());
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [selectedShedId, setSelectedShedId] = useState<string>("");
  const [dashboardShift, setDashboardShift] = useState<Shift | "">("");
  const [activeTab, setActiveTab] = useState<
    "ALL" | "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "FACE_AI" | "PENDING"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [snapshotPreview, setSnapshotPreview] = useState<SnapshotPreviewData | null>(null);

  // Dialog Visibility Triggers
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showUnmarkedAbsentDialog, setShowUnmarkedAbsentDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const showFarmFilter = user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";
  const isSupervisor = user?.role === "SUPERVISOR" || (user?.roles && user.roles.includes("SUPERVISOR"));

  // Fetch Farms
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

  // Fetch Total Active Workforce
  const employees = useResource<EmployeeListResponse>(
    `employees:dashboard-count:${selectedFarmId}`,
    (signal) => fetchEmployees({ status: "ACTIVE", limit: 100, ...(selectedFarmId ? { farmId: selectedFarmId } : {}) }, signal)
  );
  const workers = useResource<WorkerListResponse>(
    `workers:dashboard-count:${selectedFarmId}`,
    (signal) => fetchWorkers({ status: "ACTIVE", limit: 100, ...(selectedFarmId ? { farmId: selectedFarmId } : {}) }, signal)
  );

  const totalActiveEmployees = employees.data?.pagination?.total ?? employees.data?.employees?.length ?? 0;
  const totalActiveWorkers = workers.data?.pagination?.total ?? workers.data?.workers?.length ?? 0;
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

  // Records Scoped to Selected Shift
  const scopedRecords = useMemo(() => {
    if (!dashboardShift) return records;
    return records.filter((r) => r.shift === dashboardShift);
  }, [records, dashboardShift]);

  // Overall KPI Metrics
  const metrics = useMemo<AttendanceMetrics>(() => {
    let presentEmployees = 0;
    let presentWorkers = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let faceAiCount = 0;
    let faceAiConfidenceSum = 0;
    let pendingApprovalCount = 0;

    for (const r of scopedRecords) {
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
    const denominator = dashboardShift
      ? (scopedRecords.length || 1)
      : (totalActiveWorkforce > 0 ? totalActiveWorkforce : records.length || 1);
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
      totalMarked: scopedRecords.length,
    };
  }, [scopedRecords, dashboardShift, totalActiveWorkforce, records.length]);

  // Shift Breakdown Data (All shifts)
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

  // Shift x Shed 2D Cross-Tab Matrix
  const shiftShedMatrix = useMemo<ShiftShedRow[]>(() => {
    const map = new Map<string, ShiftShedRow>();

    const makeEmptyCell = (): ShiftShedCell => ({
      present: 0,
      halfDay: 0,
      absent: 0,
      leave: 0,
      total: 0,
    });

    for (const s of shedList) {
      const isAcRoom = s.number.toLowerCase().includes("ac room");
      map.set(s.id, {
        shedId: s.id,
        shedNumber: s.number,
        capacity: isAcRoom ? undefined : (s.capacity && s.capacity > 0 ? s.capacity : undefined),
        byShift: {
          MORNING_SHIFT: makeEmptyCell(),
          AFTERNOON_SHIFT: makeEmptyCell(),
          NIGHT_SHIFT: makeEmptyCell(),
          OVERTIME: makeEmptyCell(),
        },
        total: makeEmptyCell(),
      });
    }

    map.set("unassigned", {
      shedId: "unassigned",
      shedNumber: "General / Staff",
      capacity: undefined,
      byShift: {
        MORNING_SHIFT: makeEmptyCell(),
        AFTERNOON_SHIFT: makeEmptyCell(),
        NIGHT_SHIFT: makeEmptyCell(),
        OVERTIME: makeEmptyCell(),
      },
      total: makeEmptyCell(),
    });

    for (const r of records) {
      const shedKey = r.shed?.id || "unassigned";
      let row = map.get(shedKey);
      if (!row) {
        row = {
          shedId: shedKey,
          shedNumber: r.shed?.number ?? "Other",
          capacity: r.shed?.capacity,
          byShift: {
            MORNING_SHIFT: makeEmptyCell(),
            AFTERNOON_SHIFT: makeEmptyCell(),
            NIGHT_SHIFT: makeEmptyCell(),
            OVERTIME: makeEmptyCell(),
          },
          total: makeEmptyCell(),
        };
        map.set(shedKey, row);
      }

      const cell = row.byShift[r.shift] || makeEmptyCell();
      row.byShift[r.shift] = cell;

      cell.total++;
      row.total.total++;

      if (r.status === "PRESENT") {
        cell.present++;
        row.total.present++;
      } else if (r.status === "HALF_DAY") {
        cell.halfDay++;
        row.total.halfDay++;
      } else if (r.status === "ABSENT") {
        cell.absent++;
        row.total.absent++;
      } else if (r.status === "LEAVE") {
        cell.leave++;
        row.total.leave++;
      }
    }

    return Array.from(map.values()).filter(
      (s) => s.total.total > 0 || shedList.some((sh) => sh.id === s.shedId)
    );
  }, [records, shedList]);

  // Shed Breakdown (scoped to active shift if filtered)
  const shedSummaries = useMemo<ShedSummaryItem[]>(() => {
    const map = new Map<string, ShedSummaryItem>();

    for (const s of shedList) {
      const isAcRoom = s.number.toLowerCase().includes("ac room");
      map.set(s.id, {
        shedId: s.id,
        shedNumber: s.number,
        capacity: isAcRoom ? undefined : (s.capacity && s.capacity > 0 ? s.capacity : undefined),
        present: 0,
        absent: 0,
        halfDay: 0,
        leave: 0,
        total: 0,
      });
    }

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
      if (dashboardShift && r.shift !== dashboardShift) continue;

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

    return Array.from(map.values()).filter((s) => s.total > 0 || shedList.some((sh) => sh.id === s.shedId));
  }, [records, shedList, dashboardShift]);

  // Filtered Records for Roster Table
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Shed Filter
      if (selectedShedId === "unassigned") {
        if (r.shedId) return false;
      } else if (selectedShedId && r.shedId !== selectedShedId) {
        return false;
      }

      // Shift Filter
      if (dashboardShift && r.shift !== dashboardShift) {
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
  }, [records, selectedShedId, dashboardShift, activeTab, searchQuery]);

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
    const pending = records.filter((r) => !r.approvedAt);
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

  const resetAllFilters = () => {
    setActiveTab("ALL");
    setSelectedShedId("");
    setDashboardShift("");
    setSearchQuery("");
  };

  const isMobile = useIsMobile();

  return (
    <div className="stack" style={{ gap: isMobile ? "0.85rem" : "1.75rem" }}>
      {/* Header & Primary Controls */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Attendance Command</h1>
              <p className="muted" style={{ fontSize: "0.75rem", margin: 0 }}>Shift rosters, face AI & shed deployment</p>
            </div>
          </div>
          {/* Quick Actions Horizontal Strip */}
          <div
            style={{
              display: "flex",
              gap: "0.35rem",
              overflowX: "auto",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              paddingBottom: "2px",
            }}
          >
            <button
              type="button"
              className="button button--primary"
              onClick={() => navigate("/attendance/face")}
              style={{
                padding: "0.25rem 0.55rem",
                fontSize: "0.75rem",
                minHeight: "28px",
                flex: "0 0 auto",
                backgroundColor: "var(--moss)",
                borderColor: "var(--moss)",
                color: "#ffffff",
                whiteSpace: "nowrap",
              }}
            >
              🤖 Face AI
            </button>
            {can("attendance:create") && (
              <>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowBulkDialog(true)}
                  style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "28px", flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  📋 Bulk
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowUnmarkedAbsentDialog(true)}
                  style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "28px", flex: "0 0 auto", color: "var(--rust, #b91c1c)", whiteSpace: "nowrap" }}
                >
                  ⚠️ Mark Absent
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setShowEntryDialog(true)}
                  style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "28px", flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  ➕ Single
                </button>
              </>
            )}
            {can("report:export") && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowExportDialog(true)}
                style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "28px", flex: "0 0 auto", whiteSpace: "nowrap" }}
              >
                📊 Export
              </button>
            )}
            <Link
              to="/attendance"
              className="button button--ghost"
              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem", minHeight: "28px", flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              Full Log ↗
            </Link>
          </div>
        </div>
      ) : (
        <PageHeader
          eyebrow="Workforce Operations"
          title="Attendance Command Center"
          description="Real-time shift rosters, face AI verification status, and shed allocations."
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
      )}

      {/* Date Navigation, Shift Control & Command Bar */}
      <AttendanceCommandBar
        date={date}
        onDateChange={setDate}
        onShiftDate={shiftDate}
        dashboardShift={dashboardShift}
        onShiftChange={setDashboardShift}
        totalRecordsCount={records.length}
        shiftSummaries={shiftSummaries}
        showFarmFilter={showFarmFilter}
        farmList={farmList}
        selectedFarmId={selectedFarmId}
        onFarmChange={(id) => {
          setSelectedFarmId(id);
          setSelectedShedId("");
        }}
        onRefresh={() => attendanceResource.reload()}
        isMobile={isMobile}
      />

      {/* KPI Overview Cards Grid */}
      <AttendanceKpiGrid
        metrics={metrics}
        dashboardShift={dashboardShift}
        scopedRecordsCount={scopedRecords.length}
        totalActiveWorkforce={totalActiveWorkforce}
        canApprove={can("attendance:approve")}
        bulkApproving={bulkApproving}
        onApproveAllPending={handleApproveAllPending}
        onResetShift={() => setDashboardShift("")}
        isMobile={isMobile}
      />

      {/* Shift Overview Table & Station Breakdown */}
      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: isMobile ? "column" : undefined, gridTemplateColumns: isMobile ? undefined : "repeat(auto-fit, minmax(360px, 1fr))", gap: isMobile ? "0.75rem" : "1.5rem" }}>
        <ShiftPerformanceTable
          shiftSummaries={shiftSummaries}
          dashboardShift={dashboardShift}
          onShiftSelect={setDashboardShift}
          isMobile={isMobile}
        />

        <ShedWorkforceCards
          shedSummaries={shedSummaries}
          selectedShedId={selectedShedId}
          onShedSelect={setSelectedShedId}
          dashboardShift={dashboardShift}
          isMobile={isMobile}
        />
      </div>

      {/* 2D Cross-Tab Matrix: Shift × Shed Stats Matrix Table */}
      <ShiftShedMatrixTable
        shiftShedMatrix={shiftShedMatrix}
        shiftSummaries={shiftSummaries}
        selectedShedId={selectedShedId}
        dashboardShift={dashboardShift}
        onSelectCell={(shedId, shift) => {
          setSelectedShedId(shedId);
          setDashboardShift(shift);
        }}
        onSelectShed={(shedId) => setSelectedShedId(selectedShedId === shedId ? "" : shedId)}
        onSelectShift={(shift) => setDashboardShift(dashboardShift === shift ? "" : shift)}
        onResetFilters={() => {
          setSelectedShedId("");
          setDashboardShift("");
        }}
        metrics={metrics}
        isMobile={isMobile}
      />

      {/* Smart Roster Table & Inspection Area */}
      <AttendanceRosterTable
        records={filteredRecords}
        allRecords={records}
        shedList={shedList}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedShedId={selectedShedId}
        onShedChange={setSelectedShedId}
        dashboardShift={dashboardShift}
        onShiftChange={setDashboardShift}
        onResetAllFilters={resetAllFilters}
        loading={attendanceResource.loading}
        date={date}
        canApprove={can("attendance:approve")}
        approvingId={approvingId}
        onApproveSingle={handleApproveSingle}
        onSnapshotPreview={setSnapshotPreview}
        isMobile={isMobile}
      />

      {/* Snapshot Preview Modal */}
      <SnapshotPreviewModal
        preview={snapshotPreview}
        onClose={() => setSnapshotPreview(null)}
      />

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
          defaultShift={dashboardShift || "MORNING_SHIFT"}
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
