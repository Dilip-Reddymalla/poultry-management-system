import { useState, useEffect } from "react";
import { useAuth } from "../../auth/use-auth.js";
import { fetchAuditLogs, exportAuditLogsUrl } from "../../api/resources.js";
import type { AuditLogListResponse } from "../../api/resources.js";
import type { AuditAction, AuditLog } from "../../api/types.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { useResource } from "../../hooks/useResource.js";
import { Dialog } from "../../components/Dialog.js";
import { EmptyState, Panel, Button } from "../../components/ui.js";

const PAGE_SIZE = 25;
const ENTITIES = ["Employee", "Farm", "Shed", "Attendance", "Company", "Worker", "User"];

export function AuditLogsPage(): React.ReactElement {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedChanges, setSelectedChanges] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  if (!user?.isSystemAdmin) {
    return (
      <div className="stack">
        <PageHeader title="Audit Logs" />
        <Panel>
          <EmptyState
            title="Access Restricted"
            description="System Audit Logs are accessible exclusively to System Administrators."
          />
        </Panel>
      </div>
    );
  }

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(entity !== "" ? { entity } : {}),
    ...(action !== "" ? { action } : {}),
    ...(search !== "" ? { search } : {}),
    ...(from !== "" ? { from } : {}),
    ...(to !== "" ? { to } : {}),
  };

  const key = JSON.stringify(query);

  const auditResource = useResource<AuditLogListResponse>(
    `audit-logs:${key}`,
    (signal) => fetchAuditLogs(query, signal),
  );

  const logs = auditResource.data?.logs ?? [];

  const handleExport = () => {
    const exportQuery = {
      ...(entity !== "" ? { entity } : {}),
      ...(action !== "" ? { action } : {}),
      ...(search !== "" ? { search } : {}),
      ...(from !== "" ? { from } : {}),
      ...(to !== "" ? { to } : {}),
    };
    window.location.href = exportAuditLogsUrl(exportQuery);
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="System Administration"
        title="Audit Logs"
        description="Comprehensive audit trail of all database mutations across companies, farms, and users."
        actions={
          <Button variant="primary" onClick={handleExport}>
            Export to Excel (.xlsx)
          </Button>
        }
      />

      <Panel bleed>
        <div className="filters" style={{ flexWrap: "wrap" }}>
          <label className="filters__field">
            <span className="label">Search</span>
            <input
              type="text"
              className="input"
              placeholder="Search summary, actor, email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>

          <label className="filters__field">
            <span className="label">Entity</span>
            <select
              className="input select"
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            >
              <option value="">All Entities</option>
              {ENTITIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="filters__field">
            <span className="label">Action</span>
            <select
              className="input select"
              value={action}
              onChange={(e) => { setAction(e.target.value as AuditAction | ""); setPage(1); }}
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <label className="filters__field">
            <span className="label">From Date</span>
            <input
              type="date"
              className="input"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            />
          </label>

          <label className="filters__field">
            <span className="label">To Date</span>
            <input
              type="date"
              className="input"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
            />
          </label>
        </div>

        {auditResource.loading ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="panel__pad">
            <EmptyState
              title="No audit logs found"
              description="No database changes recorded matching your filter criteria."
            />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Timestamp</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Role & Org</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target Entity</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AuditLog) => (
                  <tr key={log.id}>
                    <td className="numeric" data-label="Timestamp" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                    </td>
                    <td data-label="Actor">
                      <span style={{ fontWeight: 600 }}>{log.actorName}</span>
                      {log.actorEmail ? (
                        <span className="table__sub">{log.actorEmail}</span>
                      ) : null}
                    </td>
                    <td data-label="Role & Org" style={{ fontSize: "0.85rem" }}>
                      <span>{log.actorRoles?.join(", ") || "System Admin"}</span>
                      {log.companyName ? (
                        <span className="table__sub">{log.companyName}</span>
                      ) : null}
                    </td>
                    <td data-label="Action">
                      <span
                        className={`tag tag--${
                          log.action === "CREATE"
                            ? "running"
                            : log.action === "UPDATE"
                              ? "busy"
                              : "attention"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td data-label="Target Entity">
                      <span style={{ fontWeight: 500 }}>{log.entity}</span>
                      {log.entityId ? (
                        <span className="table__sub numeric">{log.entityId.slice(0, 8)}...</span>
                      ) : null}
                    </td>
                    <td data-label="Summary" style={{ maxWidth: "300px" }}>
                      {log.summary}
                    </td>
                    <td data-label="Details">
                      {log.changes ? (
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedChanges(log.changes)}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          View Diff
                        </Button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Changes Diff Modal */}
      {selectedChanges ? (
        <Dialog title="Field Change Details" onClose={() => setSelectedChanges(null)}>
          <div className="stack">
            <pre style={{
              background: "var(--color-surface-subtle)",
              padding: "1rem",
              borderRadius: "6px",
              maxHeight: "350px",
              overflow: "auto",
              fontSize: "0.85rem"
            }}>
              {JSON.stringify(selectedChanges, null, 2)}
            </pre>
            <div style={{ textAlign: "right", marginTop: "1rem" }}>
              <Button variant="secondary" onClick={() => setSelectedChanges(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
