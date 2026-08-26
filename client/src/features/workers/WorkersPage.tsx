import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchFarms,
  fetchWorkers,
  type WorkerListResult,
} from "../../api/resources.js";
import type { Farm, WorkerStatus } from "../../api/types.js";
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
import { WorkerFormDialog } from "./WorkerFormDialog.js";

const PAGE_SIZE = 20;

export function WorkersPage(): React.ReactElement {
  const { can, user } = useAuth();
  const { notify } = useToast();

  const showFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WorkerStatus | "">("");
  const [farmId, setFarmId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: showFarm,
  });

  const key = JSON.stringify({ page, search, status, farmId });

  const workers = useResource<WorkerListResult>(`workers:${key}`, (signal) =>
    fetchWorkers({ page, limit: PAGE_SIZE, search, status, farmId }, signal),
  );

  const rows = workers.data?.workers ?? [];
  const filtered = search !== "" || status !== "" || farmId !== "";

  return (
    <div className="stack">
      <PageHeader
        eyebrow="People"
        title="Workers"
        description="Field staff recorded for attendance. Workers never sign in."
        actions={
          can("worker:create") ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon className="button__icon" />
              Add worker
            </Button>
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
              placeholder="Search name, worker ID or phone"
              aria-label="Search workers"
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
                setStatus(event.target.value as WorkerStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
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

        {workers.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={4} />
          </div>
        ) : workers.error ? (
          <div className="panel__pad">
            <ErrorState error={workers.error} onRetry={workers.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title={filtered ? "No matches" : "No workers yet"}
              description={
                filtered
                  ? "Try a different name, status or farm."
                  : "Add the first worker to start recording attendance."
              }
              {...(filtered
                ? {
                    action: (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchInput("");
                          setStatus("");
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
                    <th scope="col">Worker ID</th>
                    <th scope="col">Name</th>
                    {showFarm ? <th scope="col">Farm</th> : null}
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((worker) => (
                    <tr key={worker.id}>
                      {/* data-label feeds the row-as-card layout on phones. */}
                      <td className="numeric" data-label="Worker ID">
                        {worker.workerId}
                      </td>
                      <td data-label="Name">
                        <Link
                          className="table__link"
                          to={`/workers/${worker.id}`}
                        >
                          {worker.name}
                        </Link>
                        {worker.phone ? (
                          <span className="table__sub numeric">
                            {worker.phone}
                          </span>
                        ) : null}
                      </td>
                      {showFarm ? (
                        <td data-label="Farm">
                          <span className="table__sub">{worker.farm.code}</span>
                          {worker.farm.name}
                        </td>
                      ) : null}
                      <td data-label="Status">
                        <StatusTag status={worker.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {workers.data ? (
              <Pagination
                pagination={workers.data.pagination}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>

      {creating ? (
        <WorkerFormDialog
          worker={null}
          onClose={() => {
            setCreating(false);
          }}
          onSaved={(worker) => {
            setCreating(false);
            notify("success", `${worker.name} added.`);
            workers.reload();
          }}
        />
      ) : null}
    </div>
  );
}
