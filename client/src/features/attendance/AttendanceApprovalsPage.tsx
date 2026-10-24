import { useState, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/use-auth.js";
import {
  fetchAttendance,
  fetchFarms,
  bulkApproveAttendance,
  approveAttendance,
  type AttendanceListResponse,
} from "../../api/resources.js";
import type { Attendance, Farm, Shift } from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { useResource } from "../../hooks/useResource.js";
import { useToast } from "../../components/use-toast.js";
import { statusLabel, todayInputValue, formatDate } from "../../lib/display.js";
import {
  Button,
  Panel,
  StatusTag,
  EmptyState,
  TableSkeleton,
  ErrorState,
} from "../../components/ui.js";
import { AttendanceAvatar } from "./AttendanceAvatar.js";
import { SnapshotPreviewModal } from "./SnapshotPreviewModal.js";
import type { SnapshotPreviewData } from "./attendance-dashboard-types.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { useAutoSelectFarm } from "../../lib/farm-selection.js";
import "./Attendance.css";

type SourceFilter =
  | "ALL"
  | "GEOFENCE_EXCEEDED"
  | "IP_FALLBACK"
  | "FACE_AI"
  | "GPS_EXACT";

export function AttendanceApprovalsPage(): React.ReactElement {
  const { user } = useAuth();
  const { notify } = useToast();
  const isMobile = useIsMobile();

  const [params, setParams] = useSearchParams();
  const setParam = useCallback(
    (key: string, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Filters
  const rawSource = params.get("source") || params.get("filter") || "ALL";
  const sourceFilter = (
    ["ALL", "GEOFENCE_EXCEEDED", "IP_FALLBACK", "FACE_AI", "GPS_EXACT"].includes(
      rawSource,
    )
      ? rawSource
      : "ALL"
  ) as SourceFilter;

  // Date Filter: If navigated from notification without explicit date, default to All Dates
  const dateParam = params.get("date");
  const date =
    dateParam !== null
      ? dateParam
      : sourceFilter === "IP_FALLBACK" || sourceFilter === "GEOFENCE_EXCEEDED"
        ? ""
        : todayInputValue();

  const farmId = params.get("farmId") || "";
  const shift = (params.get("shift") || "") as Shift | "";
  const approvalTab = (params.get("tab") || "PENDING") as
    | "PENDING"
    | "APPROVED"
    | "ALL";
  const search = params.get("q") || "";
  const page = Number(params.get("page")) || 1;

  // Selected rows & modals
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [inspectingRecord, setInspectingRecord] = useState<Attendance | null>(
    null,
  );
  const [snapshotPreview, setSnapshotPreview] =
    useState<SnapshotPreviewData | null>(null);

  const showFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const farms = useResource<Farm[]>("farms:approvals", () => fetchFarms(), {
    enabled: showFarm,
  });
  const farmOptions = farms.data ?? [];

  const onSelectFarm = useCallback(
    (id: string) => {
      setParam("farmId", id);
    },
    [setParam],
  );

  const { handleFarmChange } = useAutoSelectFarm(
    farmId,
    onSelectFarm,
    farmOptions,
  );

  const attendanceResource = useResource<AttendanceListResponse>(
    `approvals:${date}:${farmId}:${shift}:${sourceFilter}:${approvalTab}:${search}:${page}`,
    (signal) =>
      fetchAttendance(
        {
          ...(date ? { date } : {}),
          ...(farmId ? { farmId } : {}),
          ...(shift ? { shift } : {}),
          ...(sourceFilter !== "ALL" && sourceFilter !== "FACE_AI"
            ? { locationSource: sourceFilter as any }
            : {}),
          ...(approvalTab === "PENDING"
            ? { pendingApproval: true }
            : approvalTab === "APPROVED"
              ? { approvalStatus: "APPROVED" }
              : {}),
          ...(search ? { search } : {}),
          limit: 200,
          page,
        },
        signal,
      ),
  );

  // Overview resource to calculate persistent KPI counts across filters
  const overviewResource = useResource<AttendanceListResponse>(
    `approvals-overview:${date}:${farmId}:${shift}:${sourceFilter}`,
    (signal) =>
      fetchAttendance(
        {
          ...(date ? { date } : {}),
          ...(farmId ? { farmId } : {}),
          ...(shift ? { shift } : {}),
          ...(sourceFilter !== "ALL" && sourceFilter !== "FACE_AI"
            ? { locationSource: sourceFilter as any }
            : {}),
          limit: 500,
        },
        signal,
      ),
  );

  const rawRecords: Attendance[] = attendanceResource.data?.attendance ?? [];
  const overviewRecords: Attendance[] =
    overviewResource.data?.attendance ?? rawRecords;

  // Client-side filter for FACE_AI if selected
  const records = useMemo(() => {
    if (sourceFilter === "FACE_AI") {
      return rawRecords.filter((r) => r.verificationMode === "FACE_AI");
    }
    return rawRecords;
  }, [rawRecords, sourceFilter]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const pendingList = overviewRecords.filter((r) => !r.approvedAt);
    return {
      totalShown: records.length,
      pending: pendingList.length,
      geofenceExceeded: pendingList.filter(
        (r) => r.locationSource === "GEOFENCE_EXCEEDED",
      ).length,
      ipFallback: pendingList.filter(
        (r) => r.locationSource === "IP_FALLBACK",
      ).length,
      faceAi: pendingList.filter((r) => r.verificationMode === "FACE_AI").length,
      approved: overviewRecords.filter((r) => r.approvedAt).length,
    };
  }, [overviewRecords, records]);

  // Selection helpers
  const pendingRecords = useMemo(
    () => records.filter((r) => !r.approvedAt),
    [records],
  );
  const allPendingSelected =
    pendingRecords.length > 0 &&
    pendingRecords.every((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRecords.map((r) => r.id)));
    }
  };

  // Single Approve
  const handleApproveSingle = async (id: string) => {
    setApprovingId(id);
    try {
      await approveAttendance(id);
      notify("success", "Attendance record approved successfully.");
      attendanceResource.reload();
      overviewResource.reload();
      if (inspectingRecord?.id === id) {
        setInspectingRecord((prev) =>
          prev
            ? { ...prev, approvedAt: new Date().toISOString(), approvedBy: { id: user?.id ?? "", name: user?.employee?.name || "You" } }
            : null,
        );
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      notify("error", err?.message || "Failed to approve.");
    } finally {
      setApprovingId(null);
    }
  };

  // Bulk Approve Selected
  const handleBulkApproveSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to approve ${ids.length} attendance record(s)?`,
      )
    )
      return;

    setBulkApproving(true);
    try {
      const res = await bulkApproveAttendance(ids);
      notify("success", `Approved ${res.approvedCount} record(s).`);
      setSelectedIds(new Set());
      attendanceResource.reload();
      overviewResource.reload();
    } catch (err: any) {
      notify("error", err?.message || "Failed to approve.");
    } finally {
      setBulkApproving(false);
    }
  };

  // Bulk Approve All Pending
  const handleBulkApproveAll = async () => {
    if (pendingRecords.length === 0) return;
    if (
      !window.confirm(
        `Approve ALL ${pendingRecords.length} pending record(s) for ${date || "all sessions"}?`,
      )
    )
      return;

    setBulkApproving(true);
    try {
      const res = await bulkApproveAttendance(
        pendingRecords.map((r) => r.id),
      );
      notify("success", `Approved ${res.approvedCount} record(s).`);
      setSelectedIds(new Set());
      attendanceResource.reload();
      overviewResource.reload();
    } catch (err: any) {
      notify("error", err?.message || "Failed to approve.");
    } finally {
      setBulkApproving(false);
    }
  };

  // Render informative reason badge for review
  const renderReasonBadge = (record: Attendance) => {
    if (record.locationSource === "GEOFENCE_EXCEEDED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 6,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            fontSize: "0.74rem",
            fontWeight: 700,
          }}
          title={record.notes || "Recorded outside farm 1KM geofence boundary"}
        >
          ⚠️ Geofence Offset
        </span>
      );
    }
    if (record.locationSource === "IP_FALLBACK") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 6,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: "0.74rem",
            fontWeight: 700,
          }}
          title={`IP: ${record.ipAddress || "Unknown"}, Accuracy: ±${record.accuracy ? Math.round(record.accuracy) + "m" : "N/A"}`}
        >
          🌐 IP Fallback
        </span>
      );
    }
    if (record.verificationMode === "FACE_AI") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 6,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "0.74rem",
            fontWeight: 700,
          }}
        >
          🤖 Face AI {record.confidenceScore ? `(${Math.round(record.confidenceScore)}%)` : ""}
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          borderRadius: 6,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#166534",
          fontSize: "0.74rem",
          fontWeight: 600,
        }}
      >
        📍 GPS Exact
      </span>
    );
  };

  return (
    <div className="stack" style={{ gap: isMobile ? "0.85rem" : "1.25rem" }}>
      <PageHeader
        title="Attendance Approvals & Audit"
        description="Review attendance requiring managerial verification: out-of-geofence locations, IP network fallbacks, and biometric exceptions."
      />

      {/* KPI Insight Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "repeat(2, 1fr)"
            : "repeat(5, 1fr)",
          gap: isMobile ? "0.5rem" : "0.75rem",
        }}
      >
        {[
          {
            label: "Total Records",
            value: kpis.totalShown,
            color: "#2563eb",
            bg: "#eff6ff",
            filterSource: "ALL",
          },
          {
            label: "Pending Review",
            value: kpis.pending,
            color: "#d97706",
            bg: "#fffbeb",
            tabKey: "PENDING",
          },
          {
            label: "⚠️ Geofence Offsets",
            value: kpis.geofenceExceeded,
            color: "#dc2626",
            bg: "#fef2f2",
            filterSource: "GEOFENCE_EXCEEDED",
          },
          {
            label: "🌐 IP Fallbacks",
            value: kpis.ipFallback,
            color: "#d97706",
            bg: "#fff7ed",
            filterSource: "IP_FALLBACK",
          },
          {
            label: "✅ Approved",
            value: kpis.approved,
            color: "#16a34a",
            bg: "#f0fdf4",
            tabKey: "APPROVED",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            onClick={() => {
              if (kpi.filterSource) {
                setParam("source", kpi.filterSource === "ALL" ? "" : kpi.filterSource);
              }
              if (kpi.tabKey) {
                setParam("tab", kpi.tabKey === "PENDING" ? "" : kpi.tabKey);
              }
            }}
            style={{
              padding: isMobile ? "8px 10px" : "12px 14px",
              borderRadius: "var(--radius)",
              background: kpi.bg,
              border: `1px solid ${kpi.color}33`,
              cursor: "pointer",
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
            }}
            title="Click to filter by this category"
          >
            <div
              style={{
                fontSize: isMobile ? 20 : 26,
                fontWeight: 700,
                color: kpi.color,
                lineHeight: 1.1,
              }}
            >
              {kpi.value}
            </div>
            <div
              style={{
                fontSize: isMobile ? 11 : 12,
                color: kpi.color,
                fontWeight: 600,
                marginTop: 3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <Panel bleed>
        <div
          style={{
            padding: isMobile ? "0.6rem 0.75rem" : "0.75rem 1.25rem",
            borderBottom: "1px solid var(--line)",
            background: "var(--surface-sunk)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: isMobile ? "0.4rem" : "0.75rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Date Selector */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setParam("date", e.target.value)}
                style={{
                  padding: "0.3rem 0.5rem",
                  fontSize: "0.82rem",
                  width: isMobile ? "100%" : "auto",
                }}
              />
              {date ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setParam("date", "")}
                  title="View all dates and past sessions"
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.45rem",
                    minHeight: "28px",
                    color: "var(--ink-soft)",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✕ All Dates
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setParam("date", todayInputValue())}
                  title="Filter to today only"
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.5rem",
                    minHeight: "28px",
                    whiteSpace: "nowrap",
                  }}
                >
                  📅 Today
                </button>
              )}
            </div>

            {/* Farm Picker */}
            {showFarm && (
              <select
                className="input"
                value={farmId}
                onChange={(e) => handleFarmChange(e.target.value)}
                style={{
                  padding: "0.3rem 0.5rem",
                  fontSize: "0.82rem",
                  minWidth: 130,
                }}
              >
                <option value="">All Farms</option>
                {farmOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            {/* Shift Picker */}
            <select
              className="input"
              value={shift}
              onChange={(e) => setParam("shift", e.target.value)}
              style={{
                padding: "0.3rem 0.5rem",
                fontSize: "0.82rem",
                minWidth: 110,
              }}
            >
              <option value="">All Shifts</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>

            {/* Reason / Source Filter */}
            <select
              className="input"
              value={sourceFilter}
              onChange={(e) =>
                setParam("source", e.target.value === "ALL" ? "" : e.target.value)
              }
              style={{
                padding: "0.3rem 0.5rem",
                fontSize: "0.82rem",
                minWidth: 140,
                fontWeight: 600,
              }}
            >
              <option value="ALL">All Review Reasons</option>
              <option value="GEOFENCE_EXCEEDED">⚠️ Geofence Offset</option>
              <option value="IP_FALLBACK">🌐 IP Fallback (No GPS)</option>
              <option value="FACE_AI">🤖 Face AI Biometric</option>
              <option value="GPS_EXACT">📍 GPS Verified Exact</option>
            </select>

            {/* Search Input */}
            <input
              type="text"
              className="input"
              placeholder="Search person, code, notes..."
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
              style={{
                padding: "0.3rem 0.5rem",
                fontSize: "0.82rem",
                flex: isMobile ? "1 1 100%" : "0 1 220px",
              }}
            />
          </div>

          {/* Status Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.35rem",
              marginTop: "0.6rem",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {(
              [
                {
                  key: "PENDING" as const,
                  label: `✍️ Pending Review (${kpis.pending})`,
                  color: "#d97706",
                },
                {
                  key: "APPROVED" as const,
                  label: `✅ Approved Records (${kpis.approved})`,
                  color: "#16a34a",
                },
                {
                  key: "ALL" as const,
                  label: `All Sessions (${kpis.totalShown})`,
                  color: undefined,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`button ${approvalTab === tab.key ? "button--primary" : "button--ghost"}`}
                style={{
                  padding: "0.25rem 0.65rem",
                  fontSize: "0.76rem",
                  minHeight: 28,
                  whiteSpace: "nowrap",
                  ...(approvalTab === tab.key && tab.color
                    ? { backgroundColor: tab.color, borderColor: tab.color }
                    : {}),
                }}
                onClick={() =>
                  setParam("tab", tab.key === "PENDING" ? "" : tab.key)
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Action Controls */}
        {pendingRecords.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: isMobile ? "0.4rem" : "0.75rem",
              padding: isMobile ? "0.45rem 0.75rem" : "0.55rem 1.25rem",
              borderBottom: "1px solid var(--line)",
              background: "#fffbeb",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAll}
              />
              Select All Pending ({pendingRecords.length})
            </label>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <Button
                type="button"
                variant="primary"
                disabled={selectedIds.size === 0 || bulkApproving}
                onClick={handleBulkApproveSelected}
                style={{ padding: "4px 12px", fontSize: 12 }}
              >
                {bulkApproving
                  ? "Approving…"
                  : `✓ Approve Selected (${selectedIds.size})`}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pendingRecords.length === 0 || bulkApproving}
                onClick={handleBulkApproveAll}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  borderColor: "#d97706",
                  color: "#92400e",
                }}
              >
                ✓ Approve All Pending
              </Button>
            </div>
          </div>
        )}

        {/* Content Section: Table vs Mobile Cards */}
        {attendanceResource.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={7} />
          </div>
        ) : attendanceResource.error ? (
          <div className="panel__pad">
            <ErrorState
              error={attendanceResource.error}
              onRetry={attendanceResource.reload}
            />
          </div>
        ) : records.length === 0 ? (
          <div className="panel__pad">
            {approvalTab === "PENDING" && kpis.approved > 0 ? (
              <div
                style={{
                  padding: "1.25rem 1.5rem",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "var(--radius)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "1.75rem" }}>🎉</span>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#166534",
                        fontSize: "0.95rem",
                      }}
                    >
                      All attendance submissions have been reviewed and approved!
                    </div>
                    <div
                      style={{
                        color: "#15803d",
                        fontSize: "0.82rem",
                        marginTop: 3,
                      }}
                    >
                      {kpis.approved} record(s) are officially confirmed in the database.
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setParam("tab", "APPROVED")}
                  style={{
                    borderColor: "#86efac",
                    color: "#166534",
                    fontSize: "0.82rem",
                    padding: "0.35rem 0.75rem",
                  }}
                >
                  View Approved Records ({kpis.approved}) →
                </Button>
              </div>
            ) : (
              <EmptyState
                title={
                  approvalTab === "PENDING"
                    ? "No pending approval records"
                    : "No records found"
                }
                description={
                  approvalTab === "PENDING"
                    ? date
                      ? `All attendance records for ${date} have been signed off.`
                      : "No records across any farm are currently awaiting approval."
                    : "No records match your selected filters."
                }
              />
            )}
          </div>
        ) : isMobile ? (
          /* Mobile Card View with Rich Information */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
              padding: "0.65rem",
            }}
          >
            {records.map((record) => {
              const isPending = !record.approvedAt;
              const isGeofenceExceeded =
                record.locationSource === "GEOFENCE_EXCEEDED";
              const isIpFallback = record.locationSource === "IP_FALLBACK";

              return (
                <div
                  key={record.id}
                  style={{
                    background: isPending ? "#fffef7" : "var(--surface)",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${
                      isGeofenceExceeded && isPending
                        ? "#fca5a5"
                        : isIpFallback && isPending
                          ? "#fde68a"
                          : isPending
                            ? "var(--clay)"
                            : "var(--line)"
                    }`,
                    padding: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {isPending && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => toggleSelect(record.id)}
                          style={{ width: 16, height: 16 }}
                        />
                      )}
                      <AttendanceAvatar
                        photoUrl={record.person.photoUrl}
                        name={record.person.name}
                        type={record.person.type}
                        size={36}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {record.person.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                          {record.person.type === "EMPLOYEE" ? "👔 Emp" : "🚜 Wkr"} ·{" "}
                          <span className="numeric">{record.person.code}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <StatusTag status={record.status} />
                      <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
                        {statusLabel(record.shift)}
                      </span>
                    </div>
                  </div>

                  {/* Primary Review Reason Banner */}
                  <div>
                    {isGeofenceExceeded ? (
                      <div
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: "0.76rem",
                          color: "#991b1b",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>
                          ⚠️ Location Out-of-Geofence
                        </div>
                        <div style={{ fontSize: "0.72rem" }}>
                          {record.notes || "Recorded outside farm 1KM geofence boundary."}
                        </div>
                      </div>
                    ) : isIpFallback ? (
                      <div
                        style={{
                          background: "#fef3c7",
                          border: "1px solid #fde68a",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: "0.76rem",
                          color: "#92400e",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>
                          🌐 IP Fallback (GPS Unavailable)
                        </div>
                        <div style={{ fontSize: "0.72rem" }}>
                          IP: {record.ipAddress || "Unknown"} · Accuracy: ±
                          {record.accuracy ? Math.round(record.accuracy) + "m" : "Approx"}
                        </div>
                      </div>
                    ) : record.verificationMode === "FACE_AI" ? (
                      <div
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: "0.76rem",
                          color: "#1e40af",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong>🤖 Face AI Verification</strong>
                          <div style={{ fontSize: "0.72rem" }}>
                            Confidence: {record.confidenceScore ? Math.round(record.confidenceScore) + "%" : "Verified"}
                          </div>
                        </div>
                        {record.snapshotUrl && (
                          <button
                            type="button"
                            className="button button--ghost"
                            style={{ padding: "2px 6px", fontSize: "0.72rem" }}
                            onClick={() =>
                              setSnapshotPreview({
                                url: record.snapshotUrl!,
                                name: record.person.name,
                                score: record.confidenceScore,
                              })
                            }
                          >
                            🔍 Photo
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {renderReasonBadge(record)}
                      </div>
                    )}
                  </div>

                  {/* Station & Coordinates Context */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      color: "var(--ink-soft)",
                    }}
                  >
                    <span>
                      🏠 {record.farm.name} · {record.shed?.number ? `Shed ${record.shed.number}` : "General"}
                    </span>
                    {record.latitude != null && record.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                      >
                        📍 View Map ↗
                      </a>
                    )}
                  </div>

                  {/* Submission Audit Meta */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.72rem",
                      borderTop: "1px dashed var(--line)",
                      paddingTop: "0.4rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>
                      {record.createdAt
                        ? `Recorded at ${new Date(record.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "—"}
                      {record.recordedBy?.name ? ` by ${record.recordedBy.name}` : ""}
                    </span>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ padding: "2px 8px", fontSize: "0.72rem" }}
                        onClick={() => setInspectingRecord(record)}
                      >
                        🔍 Details
                      </button>
                      {isPending ? (
                        <Button
                          type="button"
                          variant="primary"
                          disabled={approvingId === record.id || bulkApproving}
                          onClick={() => handleApproveSingle(record.id)}
                          style={{ padding: "3px 10px", fontSize: "0.72rem" }}
                        >
                          {approvingId === record.id ? "…" : "✓ Approve"}
                        </Button>
                      ) : (
                        <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.72rem" }}>
                          ✓ Approved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Modern Information Table */
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {approvalTab !== "APPROVED" && (
                    <th scope="col" style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={toggleSelectAll}
                        title="Select all pending"
                      />
                    </th>
                  )}
                  <th scope="col">Person & Role</th>
                  <th scope="col">Review Trigger / Reason</th>
                  <th scope="col">Location & Notes</th>
                  <th scope="col">Farm & Station</th>
                  <th scope="col">Shift & Status</th>
                  <th scope="col">Recorded At & By</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isPending = !record.approvedAt;
                  const isGeofenceExceeded =
                    record.locationSource === "GEOFENCE_EXCEEDED";

                  return (
                    <tr
                      key={record.id}
                      style={{
                        background: isPending
                          ? isGeofenceExceeded
                            ? "#fff9f9"
                            : "#fffef5"
                          : undefined,
                      }}
                    >
                      {/* Checkbox */}
                      {approvalTab !== "APPROVED" && (
                        <td>
                          {isPending ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(record.id)}
                              onChange={() => toggleSelect(record.id)}
                            />
                          ) : (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>
                              ✓
                            </span>
                          )}
                        </td>
                      )}

                      {/* Person */}
                      <td data-label="Person">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                          }}
                        >
                          <AttendanceAvatar
                            photoUrl={record.person.photoUrl}
                            name={record.person.name}
                            type={record.person.type}
                            size={34}
                            onPreview={
                              record.person.photoUrl
                                ? () =>
                                    setSnapshotPreview({
                                      url: record.person.photoUrl!,
                                      name: record.person.name,
                                      title: `${record.person.type === "EMPLOYEE" ? "Employee" : "Worker"} Profile Photo`,
                                    })
                                : undefined
                            }
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {record.person.name}
                            </div>
                            <span
                              className="table__sub numeric"
                              style={{ fontSize: 11 }}
                            >
                              {record.person.type === "EMPLOYEE"
                                ? "👔 Employee"
                                : "🚜 Worker"}{" "}
                              · {record.person.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Review Reason Badge & Biometrics */}
                      <td data-label="Review Trigger">
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            alignItems: "flex-start",
                          }}
                        >
                          {renderReasonBadge(record)}
                          {record.verificationMode === "FACE_AI" &&
                            record.snapshotUrl && (
                              <button
                                type="button"
                                className="button button--ghost"
                                style={{
                                  padding: "1px 5px",
                                  fontSize: "0.7rem",
                                  minHeight: "20px",
                                }}
                                onClick={() =>
                                  setSnapshotPreview({
                                    url: record.snapshotUrl!,
                                    name: record.person.name,
                                    score: record.confidenceScore,
                                  })
                                }
                              >
                                📸 View Face Photo
                              </button>
                            )}
                        </div>
                      </td>

                      {/* Location & Operator Notes */}
                      <td data-label="Location & Notes" style={{ maxWidth: 260 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {record.notes ? (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: isGeofenceExceeded
                                  ? "#991b1b"
                                  : "var(--ink)",
                                fontWeight: isGeofenceExceeded ? 600 : 500,
                                background: isGeofenceExceeded
                                  ? "#fee2e2"
                                  : "var(--surface-sunk)",
                                padding: "3px 6px",
                                borderRadius: 4,
                                border: `1px solid ${
                                  isGeofenceExceeded ? "#fca5a5" : "var(--line)"
                                }`,
                              }}
                            >
                              {record.notes}
                            </div>
                          ) : null}

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: "0.75rem",
                            }}
                          >
                            {record.latitude != null &&
                            record.longitude != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#2563eb",
                                  textDecoration: "none",
                                  fontWeight: 600,
                                }}
                                title="Open exact coordinate location in Google Maps"
                              >
                                📍 {record.latitude.toFixed(4)},{" "}
                                {record.longitude.toFixed(4)} ↗
                              </a>
                            ) : (
                              <span className="muted">No GPS coordinates</span>
                            )}
                            {record.accuracy && (
                              <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                                (±{Math.round(record.accuracy)}m)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Farm & Station */}
                      <td data-label="Farm & Station">
                        <div style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                          {record.farm.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {record.shed?.number
                            ? `Shed ${record.shed.number}`
                            : "General / Staff"}
                        </div>
                      </td>

                      {/* Shift & Status */}
                      <td data-label="Shift & Status">
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <StatusTag status={record.status} />
                          <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                            {statusLabel(record.shift)}
                          </span>
                        </div>
                      </td>

                      {/* Submitter & Time */}
                      <td data-label="Recorded Time">
                        <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                          {record.createdAt
                            ? new Date(record.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          {record.recordedBy?.name
                            ? `by ${record.recordedBy.name}`
                            : "System"}
                        </div>
                      </td>

                      {/* Action */}
                      <td data-label="Action" style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "0.4rem",
                          }}
                        >
                          <button
                            type="button"
                            className="button button--ghost"
                            style={{
                              padding: "3px 8px",
                              fontSize: "0.74rem",
                              minHeight: 24,
                            }}
                            onClick={() => setInspectingRecord(record)}
                            title="Inspect full audit trail and geofence data"
                          >
                            🔍 Inspect
                          </button>

                          {isPending ? (
                            <Button
                              type="button"
                              variant="primary"
                              disabled={
                                approvingId === record.id || bulkApproving
                              }
                              onClick={() => handleApproveSingle(record.id)}
                              style={{
                                padding: "3px 10px",
                                fontSize: "0.74rem",
                                minHeight: 24,
                              }}
                            >
                              {approvingId === record.id
                                ? "Approving…"
                                : "✓ Approve"}
                            </Button>
                          ) : (
                            <div style={{ textAlign: "right" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  color: "#166534",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                }}
                              >
                                ✓ Approved
                              </span>
                              {record.approvedBy && (
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--muted)",
                                  }}
                                >
                                  by {record.approvedBy.name}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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
      <SnapshotPreviewModal
        preview={snapshotPreview}
        onClose={() => setSnapshotPreview(null)}
      />

      {/* Deep Inspection & Review Modal */}
      {inspectingRecord && (
        <div
          role="dialog"
          aria-modal="true"
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
          onClick={() => setInspectingRecord(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-lg)",
              padding: isMobile ? "1.2rem" : "1.5rem",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "var(--shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                borderBottom: "1px solid var(--line)",
                paddingBottom: "0.75rem",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                  Attendance Verification Audit
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  ID: {inspectingRecord.id} · {formatDate(inspectingRecord.date)}
                </span>
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setInspectingRecord(null)}
                style={{ padding: "0.2rem 0.5rem", minHeight: "28px" }}
              >
                ✕
              </button>
            </div>

            {/* Person & Roster Profile */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                background: "var(--surface-sunk)",
                padding: "0.75rem",
                borderRadius: "var(--radius)",
                marginBottom: "1rem",
              }}
            >
              <AttendanceAvatar
                photoUrl={inspectingRecord.person.photoUrl}
                name={inspectingRecord.person.name}
                type={inspectingRecord.person.type}
                size={44}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {inspectingRecord.person.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  {inspectingRecord.person.type === "EMPLOYEE" ? "👔 Employee" : "🚜 Worker"} ·{" "}
                  <span className="numeric">{inspectingRecord.person.code}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                  Farm: {inspectingRecord.farm.name} ({inspectingRecord.farm.code}) ·{" "}
                  {inspectingRecord.shed?.number ? `Shed ${inspectingRecord.shed.number}` : "General / Staff"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <StatusTag status={inspectingRecord.status} />
                <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 4 }}>
                  {statusLabel(inspectingRecord.shift)}
                </div>
              </div>
            </div>

            {/* Audit Trigger Explanation Banner */}
            <div style={{ marginBottom: "1rem" }}>
              {inspectingRecord.locationSource === "GEOFENCE_EXCEEDED" ? (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#991b1b",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>⚠️</span> Farm Geofence Boundary Exceeded
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#7f1d1d", margin: "4px 0 0" }}>
                    The attendance was recorded outside the permitted farm boundary.
                    Managerial confirmation is required to verify legitimate off-site work.
                  </p>
                  {inspectingRecord.notes && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        background: "#fff",
                        padding: "6px 8px",
                        borderRadius: 4,
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#991b1b",
                        border: "1px solid #fecaca",
                      }}
                    >
                      {inspectingRecord.notes}
                    </div>
                  )}
                </div>
              ) : inspectingRecord.locationSource === "IP_FALLBACK" ? (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#92400e",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>🌐</span> Network IP-Based Location Fallback
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#78350f", margin: "4px 0 0" }}>
                    Device GPS was unavailable at submission time. The system used IP network
                    triangulation. Please confirm the worker was on farm premises.
                  </p>
                  <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#92400e" }}>
                    <strong>IP Address:</strong> {inspectingRecord.ipAddress || "Unknown"} ·{" "}
                    <strong>Accuracy:</strong> ±{inspectingRecord.accuracy ? Math.round(inspectingRecord.accuracy) + "m" : "Approx"}
                  </div>
                </div>
              ) : inspectingRecord.verificationMode === "FACE_AI" ? (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#1e40af",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>🤖</span> Face AI Biometric Capture
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#1e3a8a", marginTop: 4 }}>
                    Confidence Match:{" "}
                    <strong>
                      {inspectingRecord.confidenceScore ? Math.round(inspectingRecord.confidenceScore) + "%" : "Verified"}
                    </strong>
                    {inspectingRecord.livenessScore != null && (
                      <span> · Liveness: {(inspectingRecord.livenessScore * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#166534", fontSize: "0.85rem" }}>
                    📍 Standard GPS Submission
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "#14532d", margin: "4px 0 0" }}>
                    Recorded within normal operating tolerances.
                  </p>
                </div>
              )}
            </div>

            {/* Face Snapshot Media Preview if Available */}
            {inspectingRecord.snapshotUrl && (
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Verification Camera Snapshot
                </span>
                <img
                  src={inspectingRecord.snapshotUrl}
                  alt={`Snapshot of ${inspectingRecord.person.name}`}
                  style={{
                    maxHeight: 180,
                    borderRadius: "var(--radius)",
                    border: "2px solid var(--line)",
                    objectFit: "cover",
                  }}
                />
              </div>
            )}

            {/* Location & Coordinates Breakdown */}
            <div
              style={{
                fontSize: "0.82rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                background: "var(--surface-sunk)",
                padding: "0.75rem",
                borderRadius: "var(--radius)",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Recorded Coordinates:</span>
                {inspectingRecord.latitude != null && inspectingRecord.longitude != null ? (
                  <span className="numeric font-medium">
                    {inspectingRecord.latitude.toFixed(6)}, {inspectingRecord.longitude.toFixed(6)}
                  </span>
                ) : (
                  <span className="muted">Not recorded</span>
                )}
              </div>
              {inspectingRecord.latitude != null && inspectingRecord.longitude != null && (
                <div style={{ textAlign: "right" }}>
                  <a
                    href={`https://www.google.com/maps?q=${inspectingRecord.latitude},${inspectingRecord.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="table__link"
                    style={{ fontSize: "0.78rem" }}
                  >
                    Open in Google Maps ↗
                  </a>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--line)", paddingTop: "0.4rem" }}>
                <span className="muted">Recorded By:</span>
                <span>{inspectingRecord.recordedBy?.name || "System"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Submission Time:</span>
                <span>
                  {inspectingRecord.createdAt
                    ? new Date(inspectingRecord.createdAt).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Approval Status:</span>
                <span>
                  {inspectingRecord.approvedAt ? (
                    <strong style={{ color: "#166534" }}>
                      Approved on {new Date(inspectingRecord.approvedAt).toLocaleDateString()} by {inspectingRecord.approvedBy?.name || "Manager"}
                    </strong>
                  ) : (
                    <strong style={{ color: "#d97706" }}>Awaiting Manager Approval</strong>
                  )}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Link
                to={`/attendance/${inspectingRecord.id}`}
                className="button button--ghost"
                style={{ fontSize: "0.82rem" }}
              >
                Full Record Page ↗
              </Link>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setInspectingRecord(null)}
                >
                  Close
                </Button>
                {!inspectingRecord.approvedAt && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={approvingId === inspectingRecord.id}
                    onClick={() => handleApproveSingle(inspectingRecord.id)}
                  >
                    {approvingId === inspectingRecord.id ? "Approving…" : "✓ Approve Record"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
