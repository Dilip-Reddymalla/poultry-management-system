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

export function WorkerDetailPage(): React.ReactElement {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { notify } = useToast();

  const worker = useResource<Worker>(`worker:${id}`, () => fetchWorker(id));

  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const record = worker.data;
  const active = record?.status === "ACTIVE";

  const canToggle = can("worker:update");

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
            {can("worker:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {t("common.edit")}
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
            {t("workers.detail.appAccessText")}
          </p>
        </Panel>
      </div>

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
