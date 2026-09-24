import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client.js";
import { deleteWorker, fetchWorker, setWorkerActive } from "../../api/resources.js";
import type { Worker } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { ConfirmDialog } from "../../components/Dialog.js";
import {
  Button,
  CardSkeleton,
  DetailList,
  ErrorState,
  Panel,
  StatusTag,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { WorkerFormDialog } from "./WorkerFormDialog.js";
import { PromoteWorkerDialog } from "./PromoteWorkerDialog.js";

export function WorkerDetailPage(): React.ReactElement {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { notify } = useToast();

  const worker = useResource<Worker>(`worker:${id}`, () => fetchWorker(id));

  const [editing, setEditing] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const record = worker.data;
  const isPromoted = record?.status === "PROMOTED";
  const active = record?.status === "ACTIVE";

  const canToggle = can("worker:update") && !isPromoted;
  const canPromote = active && can("employee:create") && can("worker:update");

  async function handleDelete(): Promise<void> {
    if (!record) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteWorker(record.id);
      notify("success", t("workers.detail.deleteSuccess", { name: record.name }));
      navigate("/workers");
    } catch (caught) {
      notify(
        "error",
        caught instanceof ApiError ? caught.message : t("workers.detail.failedToDelete"),
      );
      setDeleteBusy(false);
      setConfirmingDelete(false);
    }
  }

  async function handleToggleStatus(): Promise<void> {
    if (!record) {
      return;
    }

    setStatusBusy(true);

    try {
      const updated = await setWorkerActive(record.id, !active);

      worker.replace(updated);
      notify(
        "success",
        active
          ? t("workers.detail.deactivatedSuccess", { name: updated.name })
          : t("workers.detail.reactivatedSuccess", { name: updated.name }),
      );
      setConfirmingStatus(false);
    } catch (caught) {
      notify(
        "error",
        caught instanceof ApiError ? caught.message : t("error.somethingWentWrong"),
      );
    } finally {
      setStatusBusy(false);
    }
  }

  if (worker.loading) {
    return (
      <div className="stack">
        <PageHeader
          title={t("workers.detail.title")}
          back={{ to: "/workers", label: t("workers.detail.allWorkers") }}
        />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (worker.error || !record) {
    return (
      <div className="stack">
        <PageHeader
          title={t("workers.detail.title")}
          back={{ to: "/workers", label: t("workers.detail.allWorkers") }}
        />
        <Panel>
          <ErrorState
            error={worker.error ?? new ApiError(404, t("error.workerNotFound"))}
            onRetry={worker.reload}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${record.farm.code} · ${record.farm.name}`}
        title={record.name}
        back={{ to: "/workers", label: t("workers.detail.allWorkers") }}
        actions={
          <>
            {can("attendance:view") ? (
              <Link
                className="button button--secondary"
                to={`/attendance?workerId=${record.id}`}
              >
                {t("common.attendance")}
              </Link>
            ) : null}
            {can("worker:update") && !isPromoted ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {t("common.edit")}
              </Button>
            ) : null}
            {canPromote ? (
              <Button
                variant="primary"
                onClick={() => {
                  setPromoting(true);
                }}
              >
                ⭐ {t("workers.promoteWorker", "Promote to Employee")}
              </Button>
            ) : null}
            {canToggle ? (
              <Button
                variant={active ? "secondary" : "primary"}
                onClick={() => {
                  setConfirmingStatus(true);
                }}
              >
                {active ? t("common.deactivate") : t("common.reactivate")}
              </Button>
            ) : null}
            {can("worker:delete") ? (
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmingDelete(true);
                }}
              >
                {t("common.delete")}
              </Button>
            ) : null}
          </>
        }
      />

      {isPromoted && record.promotedToEmployee ? (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "8px",
            backgroundColor: "rgba(139, 92, 246, 0.08)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: "#6d28d9", fontSize: "1rem" }}>
              🎉 {t("workers.detail.promotedBannerTitle", "This worker has been promoted to an Employee")}
            </div>
            <div style={{ color: "#4b5563", fontSize: "0.9rem", marginTop: "2px" }}>
              {t("workers.detail.promotedBannerSubtitle", "Active Staff Record")}: <strong>{record.promotedToEmployee.name}</strong> ({record.promotedToEmployee.employeeId})
            </div>
          </div>
          <Link
            to={`/employees/${record.promotedToEmployee.id}`}
            className="button button--primary"
            style={{ backgroundColor: "#7c3aed", borderColor: "#7c3aed" }}
          >
            {t("workers.detail.viewEmployeeProfile", "View Employee Profile →")}
          </Link>
        </div>
      ) : null}

      <div className="split">
        <Panel title={t("workers.detail.recordPanel")}>
          {record.photoUrl ? (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <img
                src={record.photoUrl}
                alt={record.name}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid var(--primary, #6366f1)",
                }}
              />
            </div>
          ) : null}
          <DetailList
            items={[
              {
                label: t("workers.workerID"),
                value: <span className="numeric">{record.workerId}</span>,
              },
              {
                label: t("common.farm"),
                value: `${record.farm.code} — ${record.farm.name}`,
              },
              {
                label: t("common.phone"),
                value: record.phone ? (
                  <span className="numeric">{record.phone}</span>
                ) : (
                  <span className="muted">{t("common.notRecorded")}</span>
                ),
              },
              { label: t("common.status"), value: <StatusTag status={record.status} /> },
            ]}
          />
        </Panel>

        <Panel title={t("workers.detail.appAccessPanel")}>
          <p className="panel__text">
            {isPromoted && record.promotedToEmployee
              ? t("workers.detail.promotedAccessText", {
                  name: record.promotedToEmployee.name,
                  id: record.promotedToEmployee.employeeId,
                  defaultValue: `This worker was promoted to employee ${record.promotedToEmployee.name} (${record.promotedToEmployee.employeeId}). Manage system access, roles, and attendance on their employee profile.`
                })
              : t("workers.detail.appAccessText")}
          </p>
        </Panel>
      </div>

      {promoting && record ? (
        <PromoteWorkerDialog
          worker={record}
          onClose={() => setPromoting(false)}
          onPromoted={(promotedEmployee) => {
            setPromoting(false);
            notify("success", t("workers.detail.promoteSuccess", "Worker promoted to employee successfully!"));
            navigate(`/employees/${promotedEmployee.id}`);
          }}
        />
      ) : null}

      {editing ? (
        <WorkerFormDialog
          worker={record}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={(updated) => {
            worker.replace(updated);
            setEditing(false);
            notify("success", t("workers.detail.updateSuccess"));
          }}
        />
      ) : null}

      {confirmingStatus ? (
        <ConfirmDialog
          title={active ? t("workers.detail.deactivateTitle") : t("workers.detail.reactivateTitle")}
          description={
            active
              ? t("workers.detail.deactivateDescription", { name: record.name })
              : t("workers.detail.reactivateDescription", { name: record.name })
          }
          confirmLabel={active ? t("common.deactivate") : t("common.reactivate")}
          confirmVariant={active ? "danger" : "primary"}
          busy={statusBusy}
          onConfirm={() => {
            void handleToggleStatus();
          }}
          onClose={() => {
            setConfirmingStatus(false);
          }}
        />
      ) : null}

      {confirmingDelete && record ? (
        <ConfirmDialog
          title={t("workers.detail.deleteTitle", { name: record.name })}
          description={t("workers.detail.deleteDescription")}
          confirmLabel={t("workers.detail.deleteConfirmLabel")}
          confirmVariant="danger"
          busy={deleteBusy}
          onConfirm={() => {
            void handleDelete();
          }}
          onClose={() => {
            if (!deleteBusy) {
              setConfirmingDelete(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
