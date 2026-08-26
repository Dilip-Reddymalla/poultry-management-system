import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
  const capacity = rows.reduce((total, shed) => total + (shed.capacity ?? 0), 0);

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
        eyebrow="Housing"
        title="Sheds"
        description="Every shed on every farm, with the capacity it holds."
        actions={
          can("shed:create") ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon className="button__icon" />
              Add shed
            </Button>
          ) : null
        }
      />

      <Panel bleed>
        <div className="filters">
          {can("farm:view") ? (
            <label className="filters__field">
              <span className="visually-hidden">Farm</span>
              <select
                className="input select"
                value={farmId}
                onChange={(event) => {
                  setParam("farmId", event.target.value);
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

          <label className="filters__field">
            <span className="visually-hidden">Status</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => {
                setParam("status", event.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="INACTIVE">Inactive</option>
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
              title={filtered ? "No sheds match" : "No sheds yet"}
              description={
                filtered
                  ? "Try another farm or status."
                  : "Add a shed to a farm to start tracking capacity."
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
                        Clear filters
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
                  <th scope="col">Shed</th>
                  <th scope="col">Farm</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((shed) => (
                  <tr key={shed.id}>
                    {/* data-label feeds the row-as-card layout on phones. */}
                    <td data-label="Shed">
                      <Link className="table__link numeric" to={`/sheds/${shed.id}`}>
                        {shed.number}
                      </Link>
                    </td>
                    <td data-label="Farm">
                      {can("farm:view") ? (
                        <Link className="table__link" to={`/farms/${shed.farm.id}`}>
                          {shed.farm.name}
                        </Link>
                      ) : (
                        shed.farm.name
                      )}
                      <span className="table__sub numeric">{shed.farm.code}</span>
                    </td>
                    <td className="numeric" data-label="Capacity">
                      {formatNumber(shed.capacity)}
                    </td>
                    <td data-label="Status">
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
            notify("success", `Shed ${shed.number} added.`);
            sheds.reload();
          }}
        />
      ) : null}
    </div>
  );
}
