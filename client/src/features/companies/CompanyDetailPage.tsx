import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../api/client.js";
import { fetchCompany, fetchFarms } from "../../api/resources.js";
import type { Company, Farm } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
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
import { CompanyFormDialog } from "./CompanyFormDialog.js";

export function CompanyDetailPage(): React.ReactElement {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const { notify } = useToast();

  const company = useResource<Company>(`company:${id}`, () => fetchCompany(id));

  // fetchFarms is scope-limited server-side; a company user only ever gets their
  // own company's farms back, so filtering by id is safe for the global admin too.
  const farms = useResource<Farm[]>(
    `company-farms:${id}`,
    (signal) => fetchFarms("", signal),
    { enabled: can("farm:view") },
  );

  const [editing, setEditing] = useState(false);

  const record = company.data;
  const farmList = (farms.data ?? []).filter(
    (farm) => farm.company.id === id,
  );

  if (company.loading) {
    return (
      <div className="stack">
        <PageHeader
          title="Company"
          back={{ to: "/companies", label: "All companies" }}
        />
        <Panel>
          <CardSkeleton />
        </Panel>
      </div>
    );
  }

  if (company.error || !record) {
    return (
      <div className="stack">
        <PageHeader
          title="Company"
          back={{ to: "/companies", label: "All companies" }}
        />
        <Panel>
          <ErrorState
            error={company.error ?? new ApiError(404, "Company not found.")}
            onRetry={company.reload}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={record.code}
        title={record.name}
        back={{ to: "/companies", label: "All companies" }}
        actions={
          can("company:update") ? (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null
        }
      />

      <div className="split">
        <Panel title="Record">
          <DetailList
            items={[
              {
                label: "Company code",
                value: <span className="numeric">{record.code}</span>,
              },
              { label: "Name", value: record.name },
              {
                label: "Farms",
                value: (
                  <span className="numeric">
                    {record.farmCount === undefined
                      ? formatNumber(farmList.length)
                      : formatNumber(record.farmCount)}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>

      {can("farm:view") ? (
        <Panel eyebrow="Sites" title="Farms in this company" bleed>
          {farms.loading ? (
            <div className="panel__pad">
              <CardSkeleton />
            </div>
          ) : farms.error ? (
            <div className="panel__pad">
              <ErrorState error={farms.error} onRetry={farms.reload} />
            </div>
          ) : farmList.length === 0 ? (
            <div className="panel__pad">
              <EmptyState
                title="No farms yet"
                description="Add a farm to this company from the farms screen."
              />
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Farm</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {farmList.map((farm) => (
                    <tr key={farm.id}>
                      <td className="numeric" data-label="Code">
                        {farm.code}
                      </td>
                      <td data-label="Farm">
                        <Link className="table__link" to={`/farms/${farm.id}`}>
                          {farm.name}
                        </Link>
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
      ) : null}

      {editing ? (
        <CompanyFormDialog
          company={record}
          onClose={() => {
            setEditing(false);
          }}
          onSaved={(updated) => {
            company.replace(updated);
            setEditing(false);
            notify("success", "Company updated.");
          }}
        />
      ) : null}
    </div>
  );
}
