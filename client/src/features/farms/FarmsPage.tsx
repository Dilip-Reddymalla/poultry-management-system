import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { fetchFarms } from "../../api/resources.js";
import type { Farm, FarmStatus } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { PlusIcon } from "../../components/icons.js";
import {
  Button,
  EmptyState,
  ErrorState,
  Panel,
  StatusTag,
  TableSkeleton,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { FarmFormDialog } from "./FarmFormDialog.js";

export function FarmsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { notify } = useToast();

  const [status, setStatus] = useState<FarmStatus | "">("");
  const [creating, setCreating] = useState(false);

  const farms = useResource<Farm[]>(`farms:${status}`, (signal) =>
    fetchFarms(status, signal),
  );

  const rows = farms.data ?? [];

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t("farms.pageEyebrow")}
        title={t("farms.pageTitle")}
        description={t("farms.pageDescription")}
        actions={
          can("farm:create") ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon className="button__icon" />
              {t("farms.addFarm")}
            </Button>
          ) : null
        }
      />

      <Panel bleed>
        <div className="filters">
          <label className="filters__field">
            <span className="visually-hidden">{t("common.status")}</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as FarmStatus | "");
              }}
            >
              <option value="">{t("common.allStatuses")}</option>
              <option value="ACTIVE">{t("common.active")}</option>
              <option value="INACTIVE">{t("common.inactive")}</option>
            </select>
          </label>
        </div>

        {farms.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={4} />
          </div>
        ) : farms.error ? (
          <div className="panel__pad">
            <ErrorState error={farms.error} onRetry={farms.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title={status ? t("farms.noFarmsWithStatus.title") : t("farms.noFarms.title")}
              description={
                status
                  ? t("farms.noFarmsWithStatus.description")
                  : t("farms.noFarms.description")
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("farms.code")}</th>
                  <th scope="col">{t("common.farm")}</th>
                  <th scope="col">{t("farms.company")}</th>
                  <th scope="col">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((farm) => (
                  <tr key={farm.id}>
                    {/* data-label feeds the row-as-card layout on phones. */}
                    <td className="numeric" data-label={t("farms.code")}>
                      {farm.code}
                    </td>
                    <td data-label={t("common.farm")}>
                      <Link className="table__link" to={`/farms/${farm.id}`}>
                        {farm.name}
                      </Link>
                    </td>
                    <td data-label={t("farms.company")}>
                      {farm.company.name}
                      <span className="table__sub numeric">
                        {farm.company.code}
                      </span>
                    </td>
                    <td data-label={t("common.status")}>
                      <StatusTag status={farm.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating ? (
        <FarmFormDialog
          farm={null}
          onClose={() => {
            setCreating(false);
          }}
          onSaved={(farm) => {
            setCreating(false);
            notify("success", `${farm.name} added.`);
            farms.reload();
          }}
        />
      ) : null}
    </div>
  );
}
