import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

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
import { MarkUnmarkedAbsentDialog } from "./MarkUnmarkedAbsentDialog.js";
import { useTranslation } from "react-i18next";
import { AttendanceAvatar } from "./AttendanceDashboardPage.js";

const PAGE_SIZE = 50;

export function AttendancePage({
  employeeId: propEmployeeId,
  workerId: propWorkerId,
}: {
  employeeId?: string;
  workerId?: string;
} = {}): React.ReactElement {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
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
  const [markingUnmarkedAbsent, setMarkingUnmarkedAbsent] = useState(false);
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
    notify("success", t("attendance.recorded"));
    attendance.reload();
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t("attendance.pageEyebrow")}
        title={t("attendance.pageTitle")}
        description={
          personMode
            ? t("attendance.pageDescriptionPerson")
            : t("attendance.pageDescriptionRoster")
        }
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {can("report:export") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setExporting(true);
                }}
              >
                {t("common.exportExcel")}
              </Button>
            ) : null}
            {can("attendance:create") ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigate("/attendance/face");
                  }}
                >
                  🎯 {t("attendance.faceAttendance")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBulkCreating(true);
                  }}
                >
                  {t("attendance.bulkMark")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMarkingUnmarkedAbsent(true);
                  }}
                  style={{ color: "var(--rust, #b91c1c)" }}
                  title={t("attendance.markUnmarkedAbsent")}
                >
                  ⚠️ {t("attendance.markUnmarkedAbsent")}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setCreating(true);
                  }}
                >
                  <PlusIcon className="button__icon" />
                  {t("attendance.recordAttendance")}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {personMode ? (
        <div className="notice">
          <span>{t("attendance.personHistory")}</span>
          <Link className="notice__link" to="/attendance">
            {t("attendance.backToRoster")}
          </Link>
        </div>
      ) : null}

      <Panel bleed>
        <div className="filters">
          {!personMode ? (
            <label className="filters__field">
              <span className="visually-hidden">{t("attendance.date")}</span>
              <input
                type="date"
                className="input"
                aria-label={t("attendance.date")}
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
                <span className="visually-hidden">{t("common.farm")}</span>
                <select
                  className="input select"
                  value={farmId}
                  onChange={(event) => {
                    setFarmId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("common.allFarms")}</option>
                  {(farms.data ?? []).map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.code} — {farm.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="filters__field">
              <span className="visually-hidden">{t("attendance.shift")}</span>
              <select
                className="input select"
                value={shift}
                onChange={(event) => {
                  setShift(event.target.value as Shift | "");
                  setPage(1);
                }}
              >
                <option value="">{t("attendance.allShifts")}</option>
                {SHIFTS.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="filters__field">
              <span className="visually-hidden">{t("common.status")}</span>
              <select
                className="input select"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AttendanceStatus | "");
                  setPage(1);
                }}
              >
                <option value="">{t("common.allStatuses")}</option>
                {ATTENDANCE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filters__field">
              <span className="visually-hidden">{t("common.search")}</span>
              <input
                type="text"
                className="input"
                placeholder={`${t("common.search")}...`}
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
                  ? t("attendance.noRecordsYet.title")
                  : status
                    ? t("attendance.noOneWithStatus.title")
                    : t("attendance.nothingForDay.title")
              }
              description={
                personMode
                  ? t("attendance.noRecordsYet.description")
                  : status
                    ? t("attendance.noOneWithStatus.description")
                    : t("attendance.nothingForDay.description")
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
                        {t("attendance.recordAttendance")}
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
                    <th scope="col">{t("attendance.date")}</th>
                    <th scope="col">{t("attendance.person")}</th>
                    {showFarm ? <th scope="col">{t("common.farm")}</th> : null}
                    <th scope="col">{t("attendance.shed")}</th>
                    <th scope="col">{t("attendance.shift")}</th>
                    <th scope="col">{t("common.status")}</th>
                    <th scope="col">{t("attendance.gpsLocation")}</th>
                    <th scope="col">{t("attendance.approval")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record) => (
                    <tr key={record.id}>
                      {/* data-label feeds the row-as-card layout on phones. */}
                      <td className="numeric" data-label={t("attendance.date")}>
                        <Link
                          className="table__link"
                          to={`/attendance/${record.id}`}
                        >
                          {formatDate(record.date)}
                        </Link>
                      </td>
                      <td data-label={t("attendance.person")}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <AttendanceAvatar
                            photoUrl={record.person.photoUrl}
                            name={record.person.name}
                            type={record.person.type}
                            size={32}
                          />
                          <div>
                            <div>{record.person.name}</div>
                            <span className="table__sub numeric">
                              {record.person.type === "EMPLOYEE"
                                ? t("attendance.employee")
                                : t("attendance.worker")}{" "}
                              · {record.person.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      {showFarm ? (
                        <td data-label={t("common.farm")}>
                          <span className="table__sub">{record.farm.code}</span>
                          {record.farm.name}
                        </td>
                      ) : null}
                      <td data-label={t("attendance.shed")}>
                        {record.shed?.number ? t("attendance.shedNumber", { number: record.shed.number }) : <span className="muted">—</span>}
                      </td>
                      <td data-label={t("attendance.shift")}>
                        {statusLabel(record.shift)}
                      </td>
                      <td data-label={t("common.status")}>
                        <StatusTag status={record.status} />
                      </td>
                      <td className="numeric" data-label={t("attendance.gpsLocation")}>
                        {record.latitude != null && record.longitude != null ? (
                          <span title={`${record.latitude}, ${record.longitude}`}>
                            📍 {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td data-label={t("attendance.approval")}>
                        {record.approvedAt ? (
                          t("common.approved")
                        ) : (
                          <span className="muted">{t("common.pending")}</span>
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

      {markingUnmarkedAbsent ? (
        <MarkUnmarkedAbsentDialog
          defaultDate={personMode ? todayInputValue() : date}
          defaultFarmId={farmId || null}
          defaultShift={shift || "MORNING_SHIFT"}
          onClose={() => {
            setMarkingUnmarkedAbsent(false);
          }}
          onSaved={() => {
            setMarkingUnmarkedAbsent(false);
            attendance.reload();
          }}
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
