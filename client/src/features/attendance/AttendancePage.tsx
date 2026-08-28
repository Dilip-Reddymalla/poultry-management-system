import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  fetchAttendance,
  fetchFarms,
  type AttendanceListResponse,
} from "../../api/resources.js";
import type {
  AttendanceStatus,
  Farm,
  Shift,
} from "../../api/types.js";
import { ATTENDANCE_STATUSES, SHIFTS } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { PlusIcon } from "../../components/icons.js";
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Panel,
  StatusTag,
  TableSkeleton,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { formatDate, statusLabel, todayInputValue } from "../../lib/display.js";
import { AttendanceEntryDialog } from "./AttendanceEntryDialog.js";
import { BulkAttendanceDialog } from "./BulkAttendanceDialog.js";
import { ExportAttendanceDialog } from "./ExportAttendanceDialog.js";

const PAGE_SIZE = 50;

export function AttendancePage({
  employeeId: propEmployeeId,
  workerId: propWorkerId,
}: {
  employeeId?: string;
  workerId?: string;
} = {}): React.ReactElement {
  const { can, user } = useAuth();
  const { notify } = useToast();
  const [params] = useSearchParams();

  const employeeId = propEmployeeId ?? params.get("employeeId") ?? "";
  const workerId = propWorkerId ?? params.get("workerId") ?? "";
  // A person link opens a history view: their records across every date, rather
  // than one day's roster.
  const personMode = employeeId !== "" || workerId !== "";

  const showFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const [date, setDate] = useState(todayInputValue());
  const [farmId, setFarmId] = useState("");
  const [shift, setShift] = useState<Shift | "">("");
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Opening a different person's history resets paging. Adjusting state during
  // render (the sanctioned pattern) rather than in an effect avoids a wasted
  // first fetch on the stale page.
  const personKey = `${employeeId}:${workerId}`;
  const [prevPersonKey, setPrevPersonKey] = useState(personKey);

  if (personKey !== prevPersonKey) {
    setPrevPersonKey(personKey);
    setPage(1);
  }

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: showFarm && !personMode,
  });

  const isSupervisor = user?.role === "SUPERVISOR";

  const query = personMode
    ? {
        page,
        limit: PAGE_SIZE,
        ...(employeeId ? { employeeId } : {}),
        ...(workerId ? { workerId } : {}),
        ...(status !== "" ? { status } : {}),
        ...(shift !== "" ? { shift } : {}),
      }
    : { 
        page, 
        limit: PAGE_SIZE, 
        date, 
        farmId, 
        ...(status !== "" ? { status } : {}), 
        ...(shift !== "" ? { shift } : {}),
        ...(search !== "" ? { search } : {}),
        ...(isSupervisor ? { recordedById: user.id } : {})
      };

  const key = JSON.stringify(query);

  const attendance = useResource<AttendanceListResponse>(
    `attendance:${key}`,
    (signal) => fetchAttendance(query, signal),
  );

  const rows = attendance.data?.attendance ?? [];

  function handleSaved(): void {
    setCreating(false);
    notify("success", "Attendance recorded.");
    attendance.reload();
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Operations"
        title="Attendance"
        description={
          personMode
            ? "Every record on file for this person."
            : "The day's roster. Colour shows who is present, absent, or off."
        }
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {/*user?.role === "ACCOUNTANT" || user?.role === "SYSTEM_ADMIN" || */can("report:export") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setExporting(true);
                }}
              >
                Export Excel
              </Button>
            ) : null}
            {can("attendance:create") ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBulkCreating(true);
                  }}
                >
                  Bulk mark
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setCreating(true);
                  }}
                >
                  <PlusIcon className="button__icon" />
                  Record attendance
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {personMode ? (
        <div className="notice">
          <span>Showing one person's history.</span>
          <Link className="notice__link" to="/attendance">
            Back to the roster
          </Link>
        </div>
      ) : null}

      <Panel bleed>
        <div className="filters">
          {!personMode ? (
            <label className="filters__field">
              <span className="visually-hidden">Date</span>
              <input
                type="date"
                className="input"
                aria-label="Attendance date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          ) : null}

          {showFarm && !personMode ? (
              <label className="filters__field">
                <span className="visually-hidden">Farm</span>
                <select
                  className="input select"
                  value={farmId}
                  onChange={(event) => {
                    setFarmId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All farms</option>
                  {(farms.data ?? []).map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.code} — {farm.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="filters__field">
              <span className="visually-hidden">Shift</span>
              <select
                className="input select"
                value={shift}
                onChange={(event) => {
                  setShift(event.target.value as Shift | "");
                  setPage(1);
                }}
              >
                <option value="">All shifts</option>
                {SHIFTS.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="filters__field">
              <span className="visually-hidden">Status</span>
              <select
                className="input select"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AttendanceStatus | "");
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {ATTENDANCE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filters__field">
              <span className="visually-hidden">Search</span>
              <input
                type="text"
                className="input"
                placeholder="Search..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>

        {attendance.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={5} />
          </div>
        ) : attendance.error ? (
          <div className="panel__pad">
            <ErrorState error={attendance.error} onRetry={attendance.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title={
                personMode
                  ? "No records yet"
                  : status
                    ? "No one with this status"
                    : "Nothing recorded for this day"
              }
              description={
                personMode
                  ? "Attendance recorded for this person will appear here."
                  : status
                    ? "Clear the status filter to see the rest of the roster."
                    : "Use Record attendance to mark the first person for this day."
              }
              {...(can("attendance:create") && !personMode
                ? {
                    action: (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCreating(true);
                        }}
                      >
                        Record attendance
                      </Button>
                    ),
                  }
                : {})}
            />
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Person</th>
                    {showFarm ? <th scope="col">Farm</th> : null}
                    <th scope="col">Shed</th>
                    <th scope="col">Shift</th>
                    <th scope="col">Status</th>
                    <th scope="col">GPS Location</th>
                    <th scope="col">Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <tr key={record.id}>
                      {/* data-label feeds the row-as-card layout on phones. */}
                      <td className="numeric" data-label="Date">
                        <Link
                          className="table__link"
                          to={`/attendance/${record.id}`}
                        >
                          {formatDate(record.date)}
                        </Link>
                      </td>
                      <td data-label="Person">
                        {record.person.name}
                        <span className="table__sub numeric">
                          {record.person.type === "EMPLOYEE"
                            ? "Employee"
                            : "Worker"}{" "}
                          · {record.person.code}
                        </span>
                      </td>
                      {showFarm ? (
                        <td data-label="Farm">
                          <span className="table__sub">{record.farm.code}</span>
                          {record.farm.name}
                        </td>
                      ) : null}
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

            {attendance.data ? (
              <Pagination
                pagination={attendance.data.pagination}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>

      {creating ? (
        <AttendanceEntryDialog
          defaultDate={personMode ? todayInputValue() : date}
          defaultFarmId={farmId || null}
          onClose={() => {
            setCreating(false);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {bulkCreating ? (
        <BulkAttendanceDialog
          defaultDate={personMode ? todayInputValue() : date}
          defaultFarmId={farmId || null}
          onClose={() => {
            setBulkCreating(false);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {exporting ? (
        <ExportAttendanceDialog
          onClose={() => {
            setExporting(false);
          }}
        />
      ) : null}
    </div>
  );
}
