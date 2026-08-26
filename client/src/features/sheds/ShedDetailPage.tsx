import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client.js";
import { fetchShed } from "../../api/resources.js";
import type { Shed } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
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
import { formatNumber } from "../../lib/display.js";
import { ShedFormDialog } from "./ShedFormDialog.js";
import { ShedStatusDialog } from "./ShedStatusDialog.js";

export function ShedDetailPage(): React.ReactElement {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const { notify } = useToast();

  const shed = useResource<Shed>(`shed:${id}`, () => fetchShed(id));

  const [editing, setEditing] = useState(false);
  const [settingStatus, setSettingStatus] = useState(false);

  const record = shed.data;

  if (shed.loading) {
    return (
      <div className="stack">
        <PageHeader title="Shed" back={{ to: "/sheds", label: "All sheds" }} />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (shed.error || !record) {
    return (
      <div className="stack">
        <PageHeader title="Shed" back={{ to: "/sheds", label: "All sheds" }} />
        <Panel>
          <ErrorState
            error={shed.error ?? new ApiError(404, "Shed not found.")}
            onRetry={shed.reload}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${record.farm.code} · ${record.farm.name}`}
        title={`Shed ${record.number}`}
        back={{ to: "/sheds", label: "All sheds" }}
        actions={
          <>
            {can("shed:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            ) : null}
            {can("shed:update-status") ? (
              <Button
                variant="primary"
                onClick={() => {
                  setSettingStatus(true);
                }}
              >
                Set status
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
                label: "Shed number",
                value: <span className="numeric">{record.number}</span>,
              },
              {
                label: "Farm",
                value: can("farm:view") ? (
                  <Link className="table__link" to={`/farms/${record.farm.id}`}>
                    {record.farm.name}
                  </Link>
                ) : (
                  record.farm.name
                ),
              },
              {
                label: "Bird capacity",
                value: (
                  <span className="numeric">
                    {formatNumber(record.capacity)}
                  </span>
                ),
              },
              { label: "Status", value: <StatusTag status={record.status} /> },
            ]}
          />
        </Panel>

        <Panel title="What status means">
          <DetailList
            items={[
              { label: "Available", value: "Ready to take a batch." },
              {
                label: "Occupied",
                value: "Holding birds. Set by batch placement, not by hand.",
              },
              { label: "Maintenance", value: "Out of use while work is done." },
              { label: "Inactive", value: "On record but not in use." },
            ]}
          />
        </Panel>
      </div>

      {editing ? (
        <ShedFormDialog
          shed={record}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={(updated) => {
            shed.replace(updated);
            setEditing(false);
            notify("success", "Shed updated.");
          }}
        />
      ) : null}

      {settingStatus ? (
        <ShedStatusDialog
          shed={record}
          onClose={() => {
            setSettingStatus(false);
          }}
          onUpdated={(updated) => {
            shed.replace(updated);
            setSettingStatus(false);
            notify(
              "success",
              `Shed ${updated.number} is now ${updated.status.toLowerCase()}.`,
            );
          }}
        />
      ) : null}
    </div>
  );
}
