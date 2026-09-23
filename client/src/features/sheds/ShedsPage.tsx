import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { fetchFarms, fetchSheds } from "../../api/resources.js";
import type { Farm, Shed, ShedStatus } from "../../api/types.js";
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
import { formatNumber } from "../../lib/display.js";
import { ShedFormDialog } from "./ShedFormDialog.js";

export function ShedsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { notify } = useToast();

  // Farm and status live in the URL so a filtered board can be linked to.
  const [params, setParams] = useSearchParams();
  const farmId = params.get("farmId") ?? "";
  const status = (params.get("status") ?? "") as ShedStatus | "";

  const [creating, setCreating] = useState(false);

  const farms = useResource<Farm[]>(
    "farms:all",
    (signal) => fetchFarms("", signal),
    { enabled: can("farm:view") },
  );

  const sheds = useResource<Shed[]>(`sheds:${farmId}:${status}`, (signal) =>
    fetchSheds({ farmId, status }, signal),
  );

  const rows = sheds.data ?? [];
  const filtered = farmId !== "" || status !== "";
  const capacity = rows
    .filter((s) => !s.number.toLowerCase().includes("ac room"))
    .reduce((total, shed) => total + (shed.capacity ?? 0), 0);

  function setParam(key: string, value: string): void {
    const next = new URLSearchParams(params);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    setParams(next, { replace: true });
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t("sheds.pageEyebrow")}
        title={t("sheds.pageTitle")}
        description={t("sheds.pageDescription")}
        actions={
          can("shed:create") ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon className="button__icon" />
              {t("sheds.addShed")}
            </Button>
          ) : null
        }
      />

      <Panel bleed>
        <div className="filters">
          {can("farm:view") ? (
            <label className="filters__field">
              <span className="visually-hidden">{t("common.farm")}</span>
              <select
                className="input select"
                value={farmId}
                onChange={(event) => {
                  setParam("farmId", event.target.value);
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

          <label className="filters__field">
            <span className="visually-hidden">{t("common.status")}</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => {
                setParam("status", event.target.value);
              }}
            >
              <option value="">{t("common.allStatuses")}</option>
              <option value="AVAILABLE">{t("sheds.available")}</option>
              <option value="OCCUPIED">{t("sheds.occupied")}</option>
              <option value="MAINTENANCE">{t("sheds.maintenance")}</option>
              <option value="INACTIVE">{t("common.inactive")}</option>
            </select>
          </label>

          {rows.length > 0 ? (
            <p className="filters__summary">
              <span className="numeric">{formatNumber(rows.length)}</span> sheds ·{" "}
              <span className="numeric">{formatNumber(capacity)}</span> birds of
              capacity
            </p>
          ) : null}
        </div>

        {sheds.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={4} />
          </div>
        ) : sheds.error ? (
          <div className="panel__pad">
            <ErrorState error={sheds.error} onRetry={sheds.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title={filtered ? t("sheds.noShedsMatch.title") : t("sheds.noSheds.title")}
              description={
                filtered
                  ? t("sheds.noShedsMatch.description")
                  : t("sheds.noSheds.description")
              }
              {...(filtered
                ? {
                    action: (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setParams(new URLSearchParams(), { replace: true });
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
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("nav.sheds")}</th>
                  <th scope="col">{t("common.farm")}</th>
                  <th scope="col">{t("sheds.capacity")}</th>
                  <th scope="col">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((shed) => (
                  <tr key={shed.id}>
                    {/* data-label feeds the row-as-card layout on phones. */}
                    <td data-label={t("nav.sheds")}>
                      <Link className="table__link numeric" to={`/sheds/${shed.id}`}>
                        {shed.number}
                      </Link>
                    </td>
                    <td data-label={t("common.farm")}>
                      {can("farm:view") ? (
                        <Link className="table__link" to={`/farms/${shed.farm.id}`}>
                          {shed.farm.name}
                        </Link>
                      ) : (
                        shed.farm.name
                      )}
                      <span className="table__sub numeric">{shed.farm.code}</span>
                    </td>
                    <td className="numeric" data-label={t("sheds.capacity")}>
                      {shed.number.toLowerCase().includes("ac room") ? (
                        <span className="muted">—</span>
                      ) : (
                        formatNumber(shed.capacity)
                      )}
                    </td>
                    <td data-label={t("common.status")}>
                      <StatusTag status={shed.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating ? (
        <ShedFormDialog
          shed={null}
          {...(farmId ? { defaultFarmId: farmId } : {})}
          onClose={() => {
            setCreating(false);
          }}
          onSaved={(shed) => {
            setCreating(false);
            notify("success", t("sheds.addedSuccess", { number: shed.number }));
            sheds.reload();
          }}
        />
      ) : null}
    </div>
  );
}
