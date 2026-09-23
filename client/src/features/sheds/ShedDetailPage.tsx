import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        <PageHeader title={t("sheds.detail.title")} back={{ to: "/sheds", label: t("sheds.detail.allSheds") }} />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (shed.error || !record) {
    return (
      <div className="stack">
        <PageHeader title={t("sheds.detail.title")} back={{ to: "/sheds", label: t("sheds.detail.allSheds") }} />
        <Panel>
          <ErrorState
            error={shed.error ?? new ApiError(404, t("error.shedNotFound"))}
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
        back={{ to: "/sheds", label: t("sheds.detail.allSheds") }}
        actions={
          <>
            {can("shed:update") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {t("common.edit")}
              </Button>
            ) : null}
            {can("shed:update-status") ? (
              <Button
                variant="primary"
                onClick={() => {
                  setSettingStatus(true);
                }}
              >
                {t("sheds.detail.setStatus")}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="split">
        <Panel title={t("sheds.detail.recordPanel")}>
          <DetailList
            items={[
              {
                label: t("sheds.detail.shedNumber"),
                value: <span className="numeric">{record.number}</span>,
              },
              {
                label: t("common.farm"),
                value: can("farm:view") ? (
                  <Link className="table__link" to={`/farms/${record.farm.id}`}>
                    {record.farm.name}
                  </Link>
                ) : (
                  record.farm.name
                ),
              },
              ...(record.number.toLowerCase().includes("ac room")
                ? [
                    {
                      label: t("sheds.detail.facilityType"),
                      value: <span>{t("sheds.detail.climateControl")}</span>,
                    },
                  ]
                : [
                    {
                      label: t("sheds.detail.birdCapacity"),
                      value: (
                        <span className="numeric">
                          {formatNumber(record.capacity)}
                        </span>
                      ),
                    },
                  ]),
              { label: t("common.status"), value: <StatusTag status={record.status} /> },
            ]}
          />
        </Panel>

        <Panel title={t("sheds.detail.statusMeaningPanel")}>
          <DetailList
            items={[
              { label: t("sheds.available"), value: t("sheds.detail.availableDesc") },
              {
                label: t("sheds.occupied"),
                value: t("sheds.detail.occupiedDesc"),
              },
              { label: t("sheds.maintenance"), value: t("sheds.detail.maintenanceDesc") },
              { label: t("common.inactive"), value: t("sheds.detail.inactiveDesc") },
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
            notify("success", t("sheds.detail.shedUpdated"));
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
              t("sheds.detail.shedNowStatus", {
                number: updated.number,
                status: updated.status.toLowerCase(),
              }),
            );
          }}
        />
      ) : null}
    </div>
  );
}
