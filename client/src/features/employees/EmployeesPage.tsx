import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
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

  const key = JSON.stringify({ page, search, status, designationId, farmId });

  const employees = useResource<EmployeeListResult>(`employees:${key}`, (signal) =>
    fetchEmployees(
      { page, limit: PAGE_SIZE, search, status, designationId, farmId },
      signal,
    ),
  );

  const rows = employees.data?.employees ?? [];
  const filtered =
    search !== "" || status !== "" || designationId !== "" || farmId !== "";

  function handleCreated(employee: Employee): void {
    setCreating(false);
    notify("success", `${employee.name} added.`);
    employees.reload();
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="People"
        title="Employees"
        description="Everyone on the register, with the designation they work under."
        actions={
          can("employee:create") ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setImportingExcel(true)}
              >
                📊 Import Excel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setCreating(true);
                }}
              >
                <PlusIcon className="button__icon" />
                Add employee
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
              placeholder="Search name, employee ID or phone"
              aria-label="Search employees"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
          </div>

          <label className="filters__field">
            <span className="visually-hidden">Status</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as EmployeeStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <label className="filters__field">
            <span className="visually-hidden">Designation</span>
            <select
              className="input select"
              value={designationId}
              onChange={(event) => {
                setDesignationId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All designations</option>
              {(designations.data ?? []).map((designation) => (
                <option key={designation.id} value={designation.id}>
                  {designation.name}
                </option>
              ))}
            </select>
          </label>

          {showFarm ? (
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
              title={filtered ? "No matches" : "No employees yet"}
              description={
                filtered
                  ? "Try a different name, status or designation."
                  : "Add the first employee to start building the register."
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
                        Clear filters
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
                    <th scope="col">Employee ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">Designation</th>
                    {showFarm ? <th scope="col">Farm</th> : null}
                    <th scope="col">Joined</th>
                    <th scope="col">Login</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((employee) => (
                    <tr key={employee.id}>
                      {/* data-label feeds the row-as-card layout on phones. */}
                      <td className="numeric" data-label="Employee ID">
                        {employee.employeeId}
                      </td>
                      <td data-label="Name">
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
                      <td data-label="Designation">
                        {employee.designation.name}
                      </td>
                      {showFarm ? (
                        <td data-label="Farm">
                          <span className="table__sub">
                            {employee.farm.code}
                          </span>
                          {employee.farm.name}
                        </td>
                      ) : null}
                      <td className="numeric" data-label="Joined">
                        {formatDate(employee.joiningDate)}
                      </td>
                      <td data-label="Login">
                        {employee.hasUser ? (
                          "Yes"
                        ) : (
                          <span className="muted">No</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <StatusTag status={employee.status} />
                      </td>
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
            notify("success", "Employee import completed.");
          }}
        />
      ) : null}
    </div>
  );
}
