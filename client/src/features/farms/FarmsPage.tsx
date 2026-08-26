import { useState } from "react";
import { Link } from "react-router-dom";

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
        eyebrow="Sites"
        title="Farms"
        description="Each farm belongs to a company and holds its own sheds."
        actions={
          can("farm:create") ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon className="button__icon" />
              Add farm
            </Button>
          ) : null
        }
      />

      <Panel bleed>
        <div className="filters">
          <label className="filters__field">
            <span className="visually-hidden">Status</span>
            <select
              className="input select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as FarmStatus | "");
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
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
              title={status ? "No farms with this status" : "No farms yet"}
              description={
                status
                  ? "Change the status filter to see the rest."
                  : "Add a farm, then add the sheds that sit on it."
              }
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Farm</th>
                  <th scope="col">Company</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((farm) => (
                  <tr key={farm.id}>
                    {/* data-label feeds the row-as-card layout on phones. */}
                    <td className="numeric" data-label="Code">
                      {farm.code}
                    </td>
                    <td data-label="Farm">
                      <Link className="table__link" to={`/farms/${farm.id}`}>
                        {farm.name}
                      </Link>
                    </td>
                    <td data-label="Company">
                      {farm.company.name}
                      <span className="table__sub numeric">
                        {farm.company.code}
                      </span>
                    </td>
                    <td data-label="Status">
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
