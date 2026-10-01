import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Button, Panel, StatusTag, EmptyState, TableSkeleton, ErrorState } from "../../components/ui.js";
import { AttendanceAvatar } from "./AttendanceAvatar.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { useTranslation } from "react-i18next";

type SourceFilter = "ALL" | "IP_FALLBACK" | "MANUAL" | "GPS";

export function AttendanceApprovalsPage(): React.ReactElement {
  const { t } = useTranslation();
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
  const date = params.get("date") || todayInputValue();
  const farmId = params.get("farmId") || "";
  const shift = (params.get("shift") || "") as Shift | "";
  const sourceFilter = (params.get("source") || "ALL") as SourceFilter;
  const approvalTab = (params.get("tab") || "PENDING") as "PENDING" | "APPROVED" | "ALL";
  const search = params.get("q") || "";
  const page = Number(params.get("page")) || 1;

  // Selected rows
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const showFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const farms = useResource<Farm[]>("farms:approvals", () => fetchFarms(), {
    enabled: showFarm,
  });
  const farmOptions = farms.data ?? [];

  const attendanceResource = useResource<AttendanceListResponse>(
    `approvals:${date}:${farmId}:${shift}:${sourceFilter}:${approvalTab}:${search}:${page}`,
    (signal) =>
      fetchAttendance(
        {
          date,
          ...(farmId ? { farmId } : {}),
          ...(shift ? { shift } : {}),
          ...(sourceFilter !== "ALL"
            ? sourceFilter === "GPS"
              ? { locationSource: "GPS_EXACT" }
              : sourceFilter === "MANUAL"
                ? {} // No filter for manual (just search manually via location source not being IP)
                : { locationSource: sourceFilter as any }
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

  const records: Attendance[] = attendanceResource.data?.attendance ?? [];

  // KPI Metrics
  const kpis = useMemo(() => {
    const all = records;
    return {
      totalShown: all.length,
      pending: all.filter((r) => !r.approvedAt).length,
      ipFallback: all.filter(
        (r) => r.locationSource === "IP_FALLBACK" && !r.approvedAt,
      ).length,
      approved: all.filter((r) => r.approvedAt).length,
    };
  }, [records]);

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

  // Approve single
  const handleApproveSingle = async (id: string) => {
    setApprovingId(id);
    try {
      await approveAttendance(id);
      notify("success", "Attendance record approved.");
      attendanceResource.reload();
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

  // Bulk approve selected
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
    } catch (err: any) {
      notify("error", err?.message || "Failed to approve.");
    } finally {
      setBulkApproving(false);
    }
  };

  // Bulk approve all pending
  const handleBulkApproveAll = async () => {
    if (pendingRecords.length === 0) return;
    if (
      !window.confirm(
        `Approve ALL ${pendingRecords.length} pending record(s) for ${date}?`,
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
    } catch (err: any) {
      notify("error", err?.message || "Failed to approve.");
    } finally {
      setBulkApproving(false);
    }
  };

  // Source badge helper
  const sourceBadge = (record: Attendance) => {
    if (record.locationSource === "IP_FALLBACK") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            borderRadius: 12,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 11,
            fontWeight: 600,
          }}
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
            borderRadius: 12,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          📸 Face AI
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
          borderRadius: 12,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#166534",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        📍 GPS
      </span>
    );
  };

  return (
    <div className="stack" style={{ gap: isMobile ? "0.85rem" : "1.5rem" }}>
      <PageHeader
        title="Attendance Approvals"
        description="Review and approve pending attendance records (IP Fallback, Face AI, manual)."
      />

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "repeat(2, 1fr)"
            : "repeat(4, 1fr)",
          gap: isMobile ? "0.5rem" : "1rem",
        }}
      >
        {[
          {
            label: "Total Shown",
            value: kpis.totalShown,
            color: "#3b82f6",
            bg: "#eff6ff",
          },
          {
            label: "Pending Approval",
            value: kpis.pending,
            color: "#d97706",
            bg: "#fffbeb",
          },
          {
            label: "IP Fallback (Pending)",
            value: kpis.ipFallback,
            color: "#ea580c",
            bg: "#fff7ed",
          },
          {
            label: "Approved",
            value: kpis.approved,
            color: "#16a34a",
            bg: "#f0fdf4",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: isMobile ? "10px 12px" : "14px 18px",
              borderRadius: 10,
              background: kpi.bg,
              border: `1px solid ${kpi.color}22`,
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 22 : 28,
                fontWeight: 700,
                color: kpi.color,
              }}
            >
              {kpi.value}
            </div>
            <div
              style={{
                fontSize: isMobile ? 11 : 12,
                color: kpi.color,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Panel bleed>
        <div
          style={{
            padding: isMobile ? "0.5rem 0.75rem" : "0.75rem 1.25rem",
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
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setParam("date", e.target.value === todayInputValue() ? "" : e.target.value)}
              style={{
                padding: "0.3rem 0.5rem",
                fontSize: "0.82rem",
                width: isMobile ? "100%" : "auto",
              }}
            />
            {showFarm && (
              <select
                className="input"
                value={farmId}
                onChange={(e) => setParam("farmId", e.target.value)}
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
            <select
              className="input"
              value={shift}
              onChange={(e) =>
                setParam("shift", e.target.value)
              }
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
            <select
              className="input"
              value={sourceFilter}
              onChange={(e) =>
                setParam("source", e.target.value === "ALL" ? "" : e.target.value)
              }
              style={{
                padding: "0.3rem 0.5rem",
                fontSize: "0.82rem",
                minWidth: 120,
              }}
            >
              <option value="ALL">All Sources</option>
              <option value="IP_FALLBACK">🌐 IP Fallback</option>
              <option value="GPS">📍 GPS Only</option>
            </select>
            <input
              type="text"
              className="input"
              placeholder="Search name, code..."
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
              style={{
                padding: "0.3rem 0.5rem",
                fontSize: "0.82rem",
                flex: isMobile ? "1 1 100%" : "0 1 220px",
              }}
            />
          </div>

          {/* Approval Status Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.25rem",
              marginTop: "0.5rem",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {(
              [
                { key: "PENDING" as const, label: `✍️ Pending (${kpis.pending})`, color: "#d97706" },
                { key: "APPROVED" as const, label: `✅ Approved (${kpis.approved})`, color: "#16a34a" },
                { key: "ALL" as const, label: `All (${kpis.totalShown})`, color: undefined },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`button ${approvalTab === tab.key ? "button--primary" : "button--ghost"}`}
                style={{
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  minHeight: 26,
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

        {/* Bulk Actions Bar */}
        {pendingRecords.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "0.4rem" : "0.75rem",
              padding: isMobile ? "0.4rem 0.75rem" : "0.5rem 1.25rem",
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
              Select All Pending
            </label>
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
              variant="ghost"
              disabled={pendingRecords.length === 0 || bulkApproving}
              onClick={handleBulkApproveAll}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                border: "1px solid #d97706",
                color: "#92400e",
              }}
            >
              ✓ Approve All Pending ({pendingRecords.length})
            </Button>
          </div>
        )}

        {/* Table */}
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
            <EmptyState
              title={
                approvalTab === "PENDING"
                  ? "No pending records"
                  : "No records found"
              }
              description={
                approvalTab === "PENDING"
                  ? "All attendance records for this date have been approved."
                  : "No records match the current filters."
              }
            />
          </div>
        ) : (
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
                  <th scope="col">Person</th>
                  <th scope="col">Farm / Shed</th>
                  <th scope="col">Shift</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source / Location</th>
                  <th scope="col">Approval</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isPending = !record.approvedAt;
                  return (
                    <tr
                      key={record.id}
                      style={{
                        background: isPending ? "#fffef5" : undefined,
                      }}
                    >
                      {approvalTab !== "APPROVED" && (
                        <td>
                          {isPending ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(record.id)}
                              onChange={() => toggleSelect(record.id)}
                            />
                          ) : (
                            <span style={{ color: "#16a34a" }}>✓</span>
                          )}
                        </td>
                      )}
                      <td data-label="Person">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <AttendanceAvatar
                            photoUrl={record.person.photoUrl}
                            name={record.person.name}
                            type={record.person.type}
                            size={32}
                          />
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {record.person.name}
                            </div>
                            <span
                              className="table__sub numeric"
                              style={{ fontSize: 11 }}
                            >
                              {record.person.type === "EMPLOYEE"
                                ? "Emp"
                                : "Wkr"}{" "}
                              · {record.person.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Farm / Shed">
                        <div style={{ fontSize: 12 }}>
                          <span className="table__sub">
                            {record.farm.code}
                          </span>{" "}
                          {record.farm.name}
                        </div>
                        {record.shed?.number && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            Shed {record.shed.number}
                          </div>
                        )}
                      </td>
                      <td data-label="Shift">{statusLabel(record.shift)}</td>
                      <td data-label="Status">
                        <StatusTag status={record.status} />
                      </td>
                      <td data-label="Source / Location">
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {sourceBadge(record)}
                          {record.latitude != null &&
                            record.longitude != null && (
                              <a
                                href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: 11,
                                  color: "#2563eb",
                                }}
                              >
                                📍 {record.latitude.toFixed(4)},{" "}
                                {record.longitude.toFixed(4)}
                                {record.accuracy
                                  ? ` (±${Math.round(record.accuracy)}m)`
                                  : ""}
                              </a>
                            )}
                          {record.ipAddress && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--muted)",
                              }}
                            >
                              IP: {record.ipAddress}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Approval">
                        {record.approvedAt ? (
                          <div>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                color: "#166534",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              ✓ Approved
                            </span>
                            {record.approvedBy && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--muted)",
                                  marginTop: 2,
                                }}
                              >
                                by {record.approvedBy.name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            disabled={
                              approvingId === record.id || bulkApproving
                            }
                            onClick={() => handleApproveSingle(record.id)}
                            style={{
                              padding: "3px 10px",
                              fontSize: 11,
                            }}
                          >
                            {approvingId === record.id
                              ? "Approving…"
                              : "✓ Approve"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
