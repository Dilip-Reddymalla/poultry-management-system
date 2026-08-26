import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client.js";
import { fetchWorker, setWorkerActive } from "../../api/resources.js";
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
  const { id = "" } = useParams();
  const { can } = useAuth();
  const { notify } = useToast();

  const worker = useResource<Worker>(`worker:${id}`, () => fetchWorker(id));

  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const record = worker.data;
  const active = record?.status === "ACTIVE";

  const canToggle = active
    ? can("worker:deactivate")
    : can("worker:reactivate");

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
        active ? `${updated.name} deactivated.` : `${updated.name} reactivated.`,
      );
      setConfirmingStatus(false);
    } catch (caught) {
      notify(
        "error",
        caught instanceof ApiError ? caught.message : "Something went wrong.",
      );
    } finally {
      setStatusBusy(false);
    }
  }

  if (worker.loading) {
    return (
      <div className="stack">
        <PageHeader
          title="Worker"
          back={{ to: "/workers", label: "All workers" }}
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
          title="Worker"
          back={{ to: "/workers", label: "All workers" }}
        />
        <Panel>
          <ErrorState
            error={worker.error ?? new ApiError(404, "Worker not found.")}
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
        back={{ to: "/workers", label: "All workers" }}
        actions={
          <>
            {can("attendance:view") ? (
              <Link
                className="button button--secondary"
                to={`/attendance?workerId=${record.id}`}
              >
                Attendance
              </Link>
            ) : null}
            {can("worker:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            ) : null}
            {canToggle ? (
              <Button
                variant={active ? "danger" : "primary"}
                onClick={() => {
                  setConfirmingStatus(true);
                }}
              >
                {active ? "Deactivate" : "Reactivate"}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="split">
        <Panel title="Record">
          <DetailList
            items={[
              {
                label: "Worker ID",
                value: <span className="numeric">{record.workerId}</span>,
              },
              {
                label: "Farm",
                value: `${record.farm.code} — ${record.farm.name}`,
              },
              {
                label: "Phone",
                value: record.phone ? (
                  <span className="numeric">{record.phone}</span>
                ) : (
                  <span className="muted">Not recorded</span>
                ),
              },
              { label: "Status", value: <StatusTag status={record.status} /> },
            ]}
          />
        </Panel>

        <Panel title="App access">
          <p className="panel__text">
            Workers are recorded for attendance only. They do not have a login
            and cannot sign in to the app.
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
            notify("success", "Worker updated.");
          }}
        />
      ) : null}

      {confirmingStatus ? (
        <ConfirmDialog
          title={active ? "Deactivate worker?" : "Reactivate worker?"}
          description={
            active
              ? `${record.name} stays on record but is marked inactive and drops off attendance entry.`
              : `${record.name} goes back to active and can be marked in attendance again.`
          }
          confirmLabel={active ? "Deactivate" : "Reactivate"}
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
    </div>
  );
}
