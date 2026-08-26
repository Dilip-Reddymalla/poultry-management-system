import { useState } from "react";
import { Link } from "react-router-dom";

import { fetchCompanies } from "../../api/resources.js";
import type { Company } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { PlusIcon } from "../../components/icons.js";
import {
  Button,
  EmptyState,
  ErrorState,
  Panel,
  TableSkeleton,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { formatNumber } from "../../lib/display.js";
import { CompanyFormDialog } from "./CompanyFormDialog.js";

export function CompaniesPage(): React.ReactElement {
  const { can } = useAuth();
  const { notify } = useToast();

  const [creating, setCreating] = useState(false);

  const companies = useResource<Company[]>("companies", (signal) =>
    fetchCompanies(signal),
  );

  const rows = companies.data ?? [];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Organization"
        title="Companies"
        description="The top of the hierarchy. Each company owns its own farms."
        actions={
          can("company:create") ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreating(true);
              }}
            >
              <PlusIcon className="button__icon" />
              Add company
            </Button>
          ) : null
        }
      />

      <Panel bleed>
        {companies.loading ? (
          <div className="panel__pad">
            <TableSkeleton columns={3} />
          </div>
        ) : companies.error ? (
          <div className="panel__pad">
            <ErrorState error={companies.error} onRetry={companies.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title="No companies yet"
              description="Add a company, then add the farms that belong to it."
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Company</th>
                  <th scope="col">Farms</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((company) => (
                  <tr key={company.id}>
                    {/* data-label feeds the row-as-card layout on phones. */}
                    <td className="numeric" data-label="Code">
                      {company.code}
                    </td>
                    <td data-label="Company">
                      <Link
                        className="table__link"
                        to={`/companies/${company.id}`}
                      >
                        {company.name}
                      </Link>
                    </td>
                    <td className="numeric" data-label="Farms">
                      {company.farmCount === undefined
                        ? "—"
                        : formatNumber(company.farmCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating ? (
        <CompanyFormDialog
          company={null}
          onClose={() => {
            setCreating(false);
          }}
          onSaved={(company) => {
            setCreating(false);
            notify("success", `${company.name} added.`);
            companies.reload();
          }}
        />
      ) : null}
    </div>
  );
}
