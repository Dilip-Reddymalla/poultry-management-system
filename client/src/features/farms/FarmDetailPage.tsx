import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client.js";
import { fetchFarm, fetchSheds, setFarmActive } from "../../api/resources.js";
import type { Farm, Shed } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { ConfirmDialog } from "../../components/Dialog.js";
import { ShedLegend, ShedStrip } from "../../components/ShedStrip.js";
import {
  Button,
  CardSkeleton,
  DetailList,
  EmptyState,
  ErrorState,
  Panel,
  StatusTag,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { formatNumber } from "../../lib/display.js";
import { FarmFormDialog } from "./FarmFormDialog.js";

export function FarmDetailPage(): React.ReactElement {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const { notify } = useToast();

  const farm = useResource<Farm>(`farm:${id}`, () => fetchFarm(id));

  const sheds = useResource<Shed[]>(
    `farm-sheds:${id}`,
    (signal) => fetchSheds({ farmId: id }, signal),
    { enabled: can("shed:view") },
  );

  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const record = farm.data;
  const active = record?.status === "ACTIVE";
  const canToggle = active ? can("farm:deactivate") : can("farm:reactivate");

  const shedList = [...(sheds.data ?? [])].sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true }),
  );
  const capacity = shedList.reduce((total, shed) => total + (shed.capacity ?? 0), 0);

  async function handleToggleStatus(): Promise<void> {
    if (!record) {
      return;
    }

    setStatusBusy(true);

    try {
      const updated = await setFarmActive(record.id, !active);

      farm.replace(updated);
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

  if (farm.loading) {
    return (
      <div className="stack">
        <PageHeader title="Farm" back={{ to: "/farms", label: "All farms" }} />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (farm.error || !record) {
    return (
      <div className="stack">
        <PageHeader title="Farm" back={{ to: "/farms", label: "All farms" }} />
        <Panel>
          <ErrorState
            error={farm.error ?? new ApiError(404, "Farm not found.")}
            onRetry={farm.reload}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${record.company.name} · ${record.code}`}
        title={record.name}
        back={{ to: "/farms", label: "All farms" }}
        actions={
          <>
            {can("farm:update") ? (
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
                label: "Farm code",
                value: <span className="numeric">{record.code}</span>,
              },
              { label: "Company", value: record.company.name },
              {
                label: "Company code",
                value: <span className="numeric">{record.company.code}</span>,
              },
              { label: "Status", value: <StatusTag status={record.status} /> },
            ]}
          />
        </Panel>

        {can("shed:view") ? (
          <Panel title="Capacity">
            <DetailList
              items={[
                {
                  label: "Sheds",
                  value: (
                    <span className="numeric">
                      {formatNumber(shedList.length)}
                    </span>
                  ),
                },
                {
                  label: "Available",
                  value: (
                    <span className="numeric">
                      {formatNumber(
                        shedList.filter((shed) => shed.status === "AVAILABLE")
                          .length,
                      )}
                    </span>
                  ),
                },
                {
                  label: "Bird capacity",
                  value: (
                    <span className="numeric">{formatNumber(capacity)}</span>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      {can("shed:view") ? (
        <Panel
          eyebrow="Shed board"
          title="Sheds on this farm"
          actions={
            <>
              <ShedLegend />
              <Link className="button button--secondary" to={`/sheds?farmId=${id}`}>
                Manage sheds
              </Link>
            </>
          }
          bleed
        >
          {sheds.loading ? (
            <div className="panel__pad">
              <CardSkeleton />
            </div>
          ) : sheds.error ? (
            <div className="panel__pad">
              <ErrorState error={sheds.error} onRetry={sheds.reload} />
            </div>
          ) : shedList.length === 0 ? (
            <div className="panel__pad">
              <EmptyState
                title="No sheds on this farm"
                description="Add sheds from the shed list to start tracking capacity."
              />
            </div>
          ) : (
            <div className="board">
              <div className="board__row">
                <div className="board__farm">
                  <span className="board__code numeric">{record.code}</span>
                  <span className="board__name">{record.name}</span>
                </div>
                <ShedStrip sheds={shedList} />
              </div>
            </div>
          )}
        </Panel>
      ) : null}

      {editing ? (
        <FarmFormDialog
          farm={record}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={(updated) => {
            farm.replace(updated);
            setEditing(false);
            notify("success", "Farm updated.");
          }}
        />
      ) : null}

      {confirmingStatus ? (
        <ConfirmDialog
          title={active ? "Deactivate farm?" : "Reactivate farm?"}
          description={
            active
              ? `${record.name} is marked inactive. Its sheds stay on record.`
              : `${record.name} goes back to active.`
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
