import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/use-auth.js";
import { fetchAttendance, fetchSheds } from "../../api/resources.js";
import type { AttendanceListResponse } from "../../api/resources.js";
import type { Shift, AttendanceStatus, Shed } from "../../api/types.js";
import { SHIFTS, ATTENDANCE_STATUSES } from "../../api/types.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { useResource } from "../../hooks/useResource.js";
import { statusLabel, todayInputValue, formatDate, formatNumber } from "../../lib/display.js";
import { EmptyState, Panel, StatusTag } from "../../components/ui.js";

interface ShiftCounts {
  PRESENT: number;
  ABSENT: number;
  HALF_DAY: number;
  LEAVE: number;
  TOTAL: number;
}

interface ShedSummary {
  shedId: string;
  shedNumber: string;
  capacity?: number;
  shiftCounts: Record<Shift, ShiftCounts>;
}

function emptyShiftCounts(): Record<Shift, ShiftCounts> {
  const counts = {} as Record<Shift, ShiftCounts>;
  for (const s of SHIFTS) {
    counts[s] = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, TOTAL: 0 };
  }
  return counts;
}

export function AttendanceDashboardPage(): React.ReactElement {
  const { user } = useAuth();
  const [date, setDate] = useState(todayInputValue());
  const [selectedShedId, setSelectedShedId] = useState<string>("");
  const [shift, setShift] = useState<Shift | "">("");

  const isSupervisor = user?.role === "SUPERVISOR" || (user?.roles && user.roles.includes("SUPERVISOR"));

  const sheds = useResource<Shed[]>("sheds:dashboard-picker", (signal) =>
    fetchSheds({}, signal),
  );

  const shedList = sheds.data ?? [];

  const query = {
    page: 1,
    limit: 1000,
    date,
    ...(selectedShedId !== "" ? { shedId: selectedShedId } : {}),
    ...(shift !== "" ? { shift } : {}),
    ...(isSupervisor && user?.id ? { recordedById: user.id } : {}),
  };

  const key = JSON.stringify(query);

  const attendance = useResource<AttendanceListResponse>(
    `attendance-dashboard:${key}`,
    (signal) => fetchAttendance(query, signal),
  );

  const records = attendance.data?.attendance ?? [];

  // Initialize Map for shed summaries
  const shedMap = new Map<string, ShedSummary>();

  // If a specific shed is selected, filter shedList to that shed; else include all sheds
  const relevantSheds = selectedShedId !== ""
    ? shedList.filter(s => s.id === selectedShedId)
    : shedList;

  for (const shed of relevantSheds) {
    shedMap.set(shed.id, {
      shedId: shed.id,
      shedNumber: shed.number,
      ...(shed.capacity != null ? { capacity: shed.capacity } : {}),
      shiftCounts: emptyShiftCounts(),
    });
  }

  // Populate counts from recorded attendance
  for (const record of records) {
    const shedId = record.shed?.id || "unassigned";
    const shedNumber = record.shed?.number ?? "General / Unassigned";

    if (!shedMap.has(shedId)) {
      // If filtering to a specific shed, don't auto-create unassigned sheds
      if (selectedShedId !== "" && shedId !== selectedShedId) continue;

      shedMap.set(shedId, {
        shedId,
        shedNumber,
        ...(record.shed?.capacity != null ? { capacity: record.shed.capacity } : {}),
        shiftCounts: emptyShiftCounts(),
      });
    }

    const summary = shedMap.get(shedId)!;
    const shiftGroup = summary.shiftCounts[record.shift];
    if (shiftGroup) {
      if (record.status in shiftGroup) {
        shiftGroup[record.status as keyof ShiftCounts] += 1;
      }
      shiftGroup.TOTAL += 1;
    }
  }

  const shedSummaries = Array.from(shedMap.values()).sort((a, b) =>
    a.shedNumber.localeCompare(b.shedNumber, undefined, { numeric: true }),
  );

  const selectedShedObject = shedList.find(s => s.id === selectedShedId);
  const selectedShedName = selectedShedObject ? `Shed ${selectedShedObject.number}` : "All Sheds";

  return (
    <div className="stack">
      <PageHeader
        title="Attendance Dashboard"
        description="Shift summary and detailed attendance records for your sheds."
        actions={
          <Link to="/attendance" className="button button--secondary">
            Full Attendance Roster
          </Link>
        }
      />

      {/* Filters Bar */}
      <div className="filters" style={{ marginBottom: "2rem" }}>
        <label className="filters__field">
          <span className="label">Date</span>
          <input
            type="date"
            className="input"
            aria-label="Attendance date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="filters__field">
          <span className="label">Shed</span>
          <select
            className="input select"
            value={selectedShedId}
            onChange={(e) => setSelectedShedId(e.target.value)}
          >
            <option value="">All Sheds</option>
            {shedList.map((shed) => (
              <option key={shed.id} value={shed.id}>
                Shed {shed.number}
              </option>
            ))}
          </select>
        </label>

        <label className="filters__field">
          <span className="label">Shift</span>
          <select
            className="input select"
            value={shift}
            onChange={(e) => setShift(e.target.value as Shift | "")}
          >
            <option value="">All shifts</option>
            {SHIFTS.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {attendance.loading || sheds.loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>Loading attendance details...</div>
      ) : (
        <div className="stack" style={{ gap: "2rem" }}>
          {/* SECTION 1: SHED SUMMARY CARDS */}
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
              {selectedShedName} Summary ({date})
            </h2>

            {shedSummaries.length === 0 ? (
              <Panel>
                <EmptyState
                  title="No shed selected or found"
                  description="Choose a shed from the dropdown to view its attendance summary."
                />
              </Panel>
            ) : (
              <div className="split" style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                {shedSummaries.map((summary) => (
                  <div key={summary.shedId} style={{ flex: "1 1 calc(50% - 1.5rem)", minWidth: "320px" }}>
                    <Panel
                      title={summary.shedNumber === "General / Unassigned" ? summary.shedNumber : `Shed ${summary.shedNumber}`}
                      eyebrow={summary.capacity != null ? `Capacity: ${formatNumber(summary.capacity)} birds` : ""}
                    >
                      <div className="stack">
                        {SHIFTS.map((s) => {
                          const counts = summary.shiftCounts[s];
                          if (counts.TOTAL === 0 && shift !== s) {
                            return (
                              <div key={s} style={{ paddingBottom: "0.5rem", borderBottom: "1px solid var(--color-stroke)" }}>
                                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{statusLabel(s)} Shift: </span>
                                <span className="muted" style={{ fontSize: "0.875rem" }}>Not marked</span>
                              </div>
                            );
                          }
                          return (
                            <div key={s} style={{ paddingBottom: "0.75rem", borderBottom: "1px solid var(--color-stroke)" }}>
                              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>{statusLabel(s)} Shift</h3>
                              {counts.TOTAL === 0 ? (
                                <span className="muted" style={{ fontSize: "0.875rem" }}>No records</span>
                              ) : (
                                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                  {ATTENDANCE_STATUSES.map((st: AttendanceStatus) => {
                                    const count = counts[st];
                                    if (count > 0) {
                                      return (
                                        <div key={st} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                          <StatusTag status={st} />
                                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{count}</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Panel>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: FULL ATTENDANCE RECORDS TABLE */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                {selectedShedName} Full Attendance Roster ({records.length} records)
              </h2>
            </div>

            <Panel bleed>
              {records.length === 0 ? (
                <div className="panel__pad">
                  <EmptyState
                    title="No attendance records"
                    description={`No attendance records found for ${selectedShedName} on ${date}${shift ? ` during ${statusLabel(shift).toLowerCase()} shift` : ""}.`}
                  />
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Person</th>
                        <th scope="col">Shed</th>
                        <th scope="col">Shift</th>
                        <th scope="col">Status</th>
                        <th scope="col">GPS Location</th>
                        <th scope="col">Notes</th>
                        <th scope="col">Approval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id}>
                          <td className="numeric" data-label="Date">
                            <Link className="table__link" to={`/attendance/${record.id}`}>
                              {formatDate(record.date)}
                            </Link>
                          </td>
                          <td data-label="Person">
                            {record.person.name}
                            <span className="table__sub numeric">
                              {record.person.type === "EMPLOYEE" ? "Employee" : "Worker"} · {record.person.code}
                            </span>
                          </td>
                          <td data-label="Shed">
                            {record.shed?.number ? `Shed ${record.shed.number}` : <span className="muted">—</span>}
                          </td>
                          <td data-label="Shift">
                            {statusLabel(record.shift)}
                          </td>
                          <td data-label="Status">
                            <StatusTag status={record.status} />
                          </td>
                          <td className="numeric" data-label="GPS Location">
                            {record.latitude != null && record.longitude != null ? (
                              <span title={`${record.latitude}, ${record.longitude}`}>
                                📍 {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td data-label="Notes">
                            {record.notes ? record.notes : <span className="muted">—</span>}
                          </td>
                          <td data-label="Approval">
                            {record.approvedAt ? (
                              "Approved"
                            ) : (
                              <span className="muted">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
