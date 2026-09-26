import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  deleteWorker,
  fetchFarms,
  fetchWorkers,
  type WorkerListResult,
} from "../../api/resources.js";
import type { Farm, Worker, WorkerStatus } from "../../api/types.js";
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
import { WorkerFormDialog } from "./WorkerFormDialog.js";
import { ExcelImportDialog } from "../../components/ExcelImportDialog.js";

const PAGE_SIZE = 20;

export function WorkersPage(): React.ReactElement {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const { notify } = useToast();

  const showFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  // URL-synced filter state
  const [params, setParams] = useSearchParams();
  const setParam = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) { next.set(key, value); } else { next.delete(key); }
      return next;
    }, { replace: true });
  }, [setParams]);

  const search = params.get("q") || "";
  const status = (params.get("status") || "") as WorkerStatus | "";
  const farmId = params.get("farmId") || "";
  const page = Number(params.get("page")) || 1;
  const sortBy = (params.get("sortBy") || "workerId") as "workerId" | "name" | "status";
  const sortOrder = (params.get("sortOrder") || "asc") as "asc" | "desc";

  const setPage = useCallback((v: number) => setParam("page", v <= 1 ? "" : String(v)), [setParam]);

  // Local input for debounced search
  const [searchInput, setSearchInput] = useState(search);

  // Transient UI state
  const [creating, setCreating] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function handleSort(field: "workerId" | "name" | "status") {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (prev.get("sortBy") === field) {
        next.set("sortOrder", prev.get("sortOrder") === "asc" ? "desc" : "asc");
      } else {
        next.set("sortBy", field);
        next.set("sortOrder", "asc");
      }
      next.delete("page");
      return next;
    }, { replace: true });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) {
        setParams((prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) { next.set("q", trimmed); } else { next.delete("q"); }
          next.delete("page");
          return next;
        }, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: showFarm,
  });

  const key = JSON.stringify({ page, search, status, farmId, sortBy, sortOrder });

  const workers = useResource<WorkerListResult>(`workers:${key}`, (signal) =>
    fetchWorkers({ page, limit: PAGE_SIZE, search, status, farmId, sortBy, sortOrder }, signal),
  );

  const rows = workers.data?.workers ?? [];
  const filtered = search !== "" || status !== "" || farmId !== "";

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t("workers.pageEyebrow")}
        title={t("workers.pageTitle")}
        description={t("workers.pageDescription")}
        actions={
          can("worker:create") ? (
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
                {t("workers.addWorker")}
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
              placeholder={t("workers.searchPlaceholder")}
              aria-label={t("workers.searchAriaLabel")}
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
                setParam("status", event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("common.allStatuses")}</option>
              <option value="ACTIVE">{t("common.active")}</option>
              <option value="INACTIVE">{t("common.inactive")}</option>
              <option value="PROMOTED">{t("common.promoted", "Promoted")}</option>
            </select>
          </label>

          {showFarm ? (
            <label className="filters__field">
              <span className="visually-hidden">{t("common.farm")}</span>
              <select
                className="input select"
                value={farmId}
                onChange={(event) => {
                  setParam("farmId", event.target.value);
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
              title={filtered ? t("workers.noMatches.title") : t("workers.noWorkers.title")}
              description={
                filtered
                  ? t("workers.noMatches.description")
                  : t("workers.noWorkers.description")
              }
              {...(filtered
                ? {
                    action: (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchInput("");
                          setParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.delete("q");
                            next.delete("status");
                            next.delete("farmId");
                            next.delete("page");
                            return next;
                          }, { replace: true });
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
                        className={`table__sort-btn ${sortBy === "workerId" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("workerId")}
                        title={t("workers.sortByWorkerID")}
                      >
                        {t("workers.workerID")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "workerId" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className={`table__sort-btn ${sortBy === "name" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("name")}
                        title={t("workers.sortByName")}
                      >
                        {t("common.name")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "name" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    {showFarm ? <th scope="col">{t("common.farm")}</th> : null}
                    <th scope="col">
                      <button
                        type="button"
                        className={`table__sort-btn ${sortBy === "status" ? "table__sort-btn--active" : ""}`}
                        onClick={() => handleSort("status")}
                        title={t("workers.sortByStatus")}
                      >
                        {t("common.status")}
                        <span className="table__sort-icon" aria-hidden="true">
                          {sortBy === "status" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                    {can("worker:delete") ? <th scope="col">{t("common.actions")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((worker) => (
                    <tr key={worker.id}>
                      {/* data-label feeds the row-as-card layout on phones. */}
                      <td className="numeric" data-label={t("workers.workerID")}>
                        {worker.workerId}
                      </td>
                      <td data-label={t("common.name")}>
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
                        <td data-label={t("common.farm")}>
                          <span className="table__sub">{worker.farm.code}</span>
                          {worker.farm.name}
                        </td>
                      ) : null}
                      <td data-label={t("common.status")}>
                        <StatusTag status={worker.status} />
                      </td>
                      {can("worker:delete") ? (
                        <td data-label={t("common.actions")}>
                          <Button
                            variant="danger"
                            onClick={() => setWorkerToDelete(worker)}
                            style={{ padding: "4px 8px", fontSize: "0.8125rem" }}
                          >
                            {t("common.delete")}
                          </Button>
                        </td>
                      ) : null}
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

      {importingExcel ? (
        <ExcelImportDialog
          type="worker"
          onClose={() => setImportingExcel(false)}
          onSuccess={() => {
            workers.reload();
            notify("success", t("workers.importCompleted"));
          }}
        />
      ) : null}

      {workerToDelete ? (
        <ConfirmDialog
          title={t("workers.detail.deleteTitle", { name: workerToDelete.name })}
          description={t("workers.detail.deleteDescription")}
          confirmLabel={t("workers.detail.deleteConfirmLabel")}
          confirmVariant="danger"
          busy={deleteBusy}
          onConfirm={async () => {
            setDeleteBusy(true);
            try {
              await deleteWorker(workerToDelete.id);
              notify("success", t("workers.detail.deleteSuccess", { name: workerToDelete.name }));
              setWorkerToDelete(null);
              workers.reload();
            } catch (caught: any) {
              notify("error", caught?.message || t("workers.detail.failedToDelete"));
            } finally {
              setDeleteBusy(false);
            }
          }}
          onClose={() => {
            if (!deleteBusy) {
              setWorkerToDelete(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
