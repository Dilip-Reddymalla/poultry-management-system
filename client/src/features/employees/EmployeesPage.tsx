import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  deleteEmployee,
  fetchDesignations,
  fetchEmployees,
  fetchFarms,
  type EmployeeListResult,
} from "../../api/resources.js";
import type {
  Designation,
  Employee,
  EmployeeStatus,
  Farm,
} from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { ConfirmDialog } from "../../components/Dialog.js";
import { PlusIcon, SearchIcon } from "../../components/icons.js";
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
import { formatDate } from "../../lib/display.js";
import { EmployeeFormDialog } from "./EmployeeFormDialog.js";
import { ExcelImportDialog } from "../../components/ExcelImportDialog.js";

const PAGE_SIZE = 20;

export function EmployeesPage(): React.ReactElement {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const { notify } = useToast();

  // A farm user sees one farm, so the picker is only useful (and only offered by
  // the API) at company/global scope. Same rule the backend scoping enforces.
  const showFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EmployeeStatus | "">("");
  const [designationId, setDesignationId] = useState("");
  const [farmId, setFarmId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sortBy, setSortBy] = useState<"employeeId" | "name" | "status" | "login">("employeeId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  function handleSort(field: "employeeId" | "name" | "status" | "login") {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

  const designations = useResource<Designation[]>("designations", () =>
    fetchDesignations(),
  );

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: showFarm,
  });

  const key = JSON.stringify({ page, search, status, designationId, farmId, sortBy, sortOrder });

  const employees = useResource<EmployeeListResult>(`employees:${key}`, (signal) =>
    fetchEmployees(
      { page, limit: PAGE_SIZE, search, status, designationId, farmId, sortBy, sortOrder },
      signal,
    ),
  );

  const rows = employees.data?.employees ?? [];
  const filtered =
    search !== "" || status !== "" || designationId !== "" || farmId !== "";

  const ROLE_HIERARCHY: Record<string, number> = {
    "System Admin": 100,
    "Company Admin": 90,
    "DGM": 80,
    "Assistant Manager": 70,
    "Super Incharge": 65,
    "Incharge": 60,
    "Asst Incharge": 55,
    "Accountant": 50,
    "Accounts Assistant": 45,
    "Stores Executive": 45,
    "Senior Supervisor": 40,
    "Supervisor": 35,
    "AC Supervisor": 35,
    "Maintenance Supervisor": 35,
    "Grading Supervisor": 35,
    "Supervisor - Litter Maintenance": 35,
    "Security Supervisor": 35,
    "Asst Supervisor": 30,
    "AC Asst Supervisor": 30,
    "Asst Supervisor General": 30,
    "Asst Supervisor - Technical": 30,
    "Asst Supervisor - Electrical": 30,
    "Security Head Guard": 20,
    "Senior Driver": 18,
    "Security Guard": 15,
    "Driver": 15,
    "Worker": 10,
  };

  function canDeleteEmployee(target: Employee): boolean {
    if (!can("employee:delete")) return false;
    if (user?.employeeId === target.id) return false;
    if (user?.isSystemAdmin) return true;
    const userRoles = user?.roles ?? [];
    const userRank = Math.max(...userRoles.map((r) => ROLE_HIERARCHY[r] ?? 0), 0);
    const targetRank = ROLE_HIERARCHY[target.designation.name] ?? 0;
    return userRank >= targetRank;
  }

  function handleCreated(employee: Employee): void {
    setCreating(false);
    notify("success", `${employee.name} added.`);
    employees.reload();
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t("employees.pageEyebrow")}
        title={t("employees.pageTitle")}
        description={t("employees.pageDescription")}
        actions={
          can("employee:create") ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setImportingExcel(true)}
              >
                📊 {t("common.importExcel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setCreating(true);
                }}
              >
                <PlusIcon className="button__icon" />
                {t("employees.addEmployee")}
              </Button>
            </div>
          ) : null
        }
      />

      <Panel bleed>
        <div className="filters">
          <div className="filters__search">
            <SearchIcon className="filters__icon" />
            <input
              type="search"
              className="input"
              placeholder={t("employees.searchPlaceholder")}
              aria-label={t("employees.searchAriaLabel")}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
          </div>

          <label className="filters__field">
            <span className="visually-hidden">{t("common.status")}</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as EmployeeStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("common.allStatuses")}</option>
              <option value="ACTIVE">{t("common.active")}</option>
              <option value="INACTIVE">{t("common.inactive")}</option>
            </select>
          </label>

          <label className="filters__field">
            <span className="visually-hidden">{t("employees.designation")}</span>
            <select
              className="input select"
              value={designationId}
              onChange={(event) => {
                setDesignationId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("employees.allDesignations")}</option>
              {(designations.data ?? []).map((designation) => (
                <option key={designation.id} value={designation.id}>
                  {designation.name}
                </option>
              ))}
            </select>
          </label>

          {showFarm ? (
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
        </div>

        {employees.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={5} />
          </div>
        ) : employees.error ? (
          <div className="panel__pad">
            <ErrorState error={employees.error} onRetry={employees.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title={filtered ? t("employees.noMatches.title") : t("employees.noEmployees.title")}
              description={
                filtered
                  ? t("employees.noMatches.description")
                  : t("employees.noEmployees.description")
              }
              {...(filtered
                ? {
                    action: (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchInput("");
                          setStatus("");
                          setDesignationId("");
                          setFarmId("");
                        }}
                      >
                        {t("common.clearFilters")}
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
                    <th scope="col">
                      <button
                        type="button"
                        className={`table__sort-btn ${sortBy === "employeeId" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("employeeId")}
                        title={t("employees.sortByEmployeeID")}
                      >
                        {t("employees.employeeID")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "employeeId" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className={`table__sort-btn ${sortBy === "name" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("name")}
                        title={t("employees.sortByName")}
                      >
                        {t("common.name")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "name" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th scope="col">{t("employees.designation")}</th>
                    {showFarm ? <th scope="col">{t("common.farm")}</th> : null}
                    <th scope="col">{t("employees.joined")}</th>
                    <th scope="col">
                      <button
                        type="button"
                        className={`table__sort-btn ${sortBy === "login" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("login")}
                        title={t("employees.sortByLogin")}
                      >
                        {t("employees.login")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "login" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className={`table__sort-btn ${sortBy === "status" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("status")}
                        title={t("employees.sortByStatus")}
                      >
                        {t("common.status")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "status" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    {can("employee:delete") ? <th scope="col">{t("common.actions")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((employee) => (
                    <tr key={employee.id}>
                      {/* data-label feeds the row-as-card layout on phones. */}
                      <td className="numeric" data-label={t("employees.employeeID")}>
                        {employee.employeeId}
                      </td>
                      <td data-label={t("common.name")}>
                        <Link
                          className="table__link"
                          to={`/employees/${employee.id}`}
                        >
                          {employee.name}
                        </Link>
                        {employee.phone ? (
                          <span className="table__sub numeric">
                            {employee.phone}
                          </span>
                        ) : null}
                      </td>
                      <td data-label={t("employees.designation")}>
                        {employee.designation.name}
                      </td>
                      {showFarm ? (
                        <td data-label={t("common.farm")}>
                          <span className="table__sub">
                            {employee.farm.code}
                          </span>
                          {employee.farm.name}
                        </td>
                      ) : null}
                      <td className="numeric" data-label={t("employees.joined")}>
                        {formatDate(employee.joiningDate)}
                      </td>
                      <td data-label={t("employees.login")}>
                        {employee.hasUser ? (
                          t("common.yes")
                        ) : (
                          <span className="muted">{t("common.no")}</span>
                        )}
                      </td>
                      <td data-label={t("common.status")}>
                        <StatusTag status={employee.status} />
                      </td>
                      {can("employee:delete") ? (
                        <td data-label={t("common.actions")}>
                          {canDeleteEmployee(employee) ? (
                            <Button
                              variant="danger"
                              onClick={() => setEmployeeToDelete(employee)}
                              style={{ padding: "4px 8px", fontSize: "0.8125rem" }}
                            >
                              {t("common.delete")}
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {employees.data ? (
              <Pagination
                pagination={employees.data.pagination}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>

      {creating ? (
        <EmployeeFormDialog
          employee={null}
          designations={designations.data ?? []}
          designationsError={designations.error}
          onClose={() => {
            setCreating(false);
          }}
          onSaved={handleCreated}
        />
      ) : null}

      {importingExcel ? (
        <ExcelImportDialog
          type="employee"
          onClose={() => setImportingExcel(false)}
          onSuccess={() => {
            employees.reload();
            notify("success", t("employees.importCompleted"));
          }}
        />
      ) : null}

      {employeeToDelete ? (
        <ConfirmDialog
          title={t("employees.deleteTitle", { name: employeeToDelete.name })}
          description={t("employees.deleteDescription")}
          confirmLabel={t("employees.deleteConfirmLabel")}
          confirmVariant="danger"
          busy={deleteBusy}
          onConfirm={async () => {
            setDeleteBusy(true);
            try {
              await deleteEmployee(employeeToDelete.id);
              notify("success", `${employeeToDelete.name} deleted.`);
              setEmployeeToDelete(null);
              employees.reload();
            } catch (caught: any) {
              notify("error", caught?.message || t("employees.failedToDelete"));
            } finally {
              setDeleteBusy(false);
            }
          }}
          onClose={() => {
            if (!deleteBusy) {
              setEmployeeToDelete(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
