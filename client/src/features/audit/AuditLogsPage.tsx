import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/use-auth.js";
import { fetchAuditLogs, exportAuditLogsUrl } from "../../api/resources.js";
import type { AuditLogListResponse } from "../../api/resources.js";
import type { AuditAction, AuditLog } from "../../api/types.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { useResource } from "../../hooks/useResource.js";
import { Dialog } from "../../components/Dialog.js";
import { EmptyState, Panel, Button } from "../../components/ui.js";
import { useSearchParams } from "react-router-dom";
import {
  fetchSystemErrors,
  fetchSystemErrorById,
  type SystemErrorItem,
} from "../../api/system-errors.js";
import { SystemErrorInspectorModal } from "./SystemErrorInspectorModal.js";
import { AlertTriangle, ShieldCheck, ExternalLink, CheckCircle, RotateCcw } from "lucide-react";
import "./AuditLogsPage.css";

const PAGE_SIZE = 25;
const ENTITIES = ["Employee", "Farm", "Shed", "Attendance", "Company", "Worker", "User"];

export function AuditLogsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();

  // URL-synced filter state
  const [params, setParams] = useSearchParams();
  const setParam = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) { next.set(key, value); } else { next.delete(key); }
      return next;
    }, { replace: true });
  }, [setParams]);

  const [activeTab, setActiveTab] = useState<"activity" | "system-errors">(
    (params.get("tab") as "activity" | "system-errors") || "activity"
  );
  const search = params.get("q") || params.get("search") || "";
  const entity = params.get("entity") || "";
  const action = (params.get("action") || "") as AuditAction | "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Number(params.get("page")) || 1;
  const errorIdParam = params.get("errorId") || "";

  const setPage = useCallback((v: number) => setParam("page", v <= 1 ? "" : String(v)), [setParam]);

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    setParams((prev) => {
      const next = new URLSearchParams();
      const currentTab = prev.get("tab");
      if (currentTab) next.set("tab", currentTab);
      return next;
    }, { replace: true });
  }, [setParams]);

  const hasActiveFilters = Boolean(search || entity || action || from || to);

  // Sync tab with URL parameter changes
  useEffect(() => {
    const tabFromUrl = params.get("tab");
    if (tabFromUrl === "system-errors" || tabFromUrl === "activity") {
      setActiveTab(tabFromUrl);
    }
  }, [params]);

  const handleTabChange = (tab: "activity" | "system-errors") => {
    setActiveTab(tab);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      next.delete("page");
      return next;
    }, { replace: true });
  };

  // Local state
  const [searchInput, setSearchInput] = useState(search);
  const [selectedChanges, setSelectedChanges] = useState<Record<string, unknown> | null>(null);

  // System errors state
  const [systemErrors, setSystemErrors] = useState<SystemErrorItem[]>([]);
  const [systemErrorsLoading, setSystemErrorsLoading] = useState(false);
  const [selectedErrorLog, setSelectedErrorLog] = useState<SystemErrorItem | null>(null);

  // Debounced search input sync
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) {
        setParams((prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) { next.set("q", trimmed); } else { next.delete("q"); next.delete("search"); }
          next.delete("page");
          return next;
        }, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load system errors when tab is active
  const loadSystemErrors = useCallback(async () => {
    if (activeTab !== "system-errors") return;
    setSystemErrorsLoading(true);
    try {
      const res = await fetchSystemErrors({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setSystemErrors(res.logs);
    } catch {
      // Handled gracefully
    } finally {
      setSystemErrorsLoading(false);
    }
  }, [activeTab, page, search, from, to]);

  useEffect(() => {
    void loadSystemErrors();
  }, [loadSystemErrors]);

  // Direct errorId link handling (e.g. from notification "Inspect Logs")
  useEffect(() => {
    if (errorIdParam) {
      void fetchSystemErrorById(errorIdParam)
        .then((res) => {
          if (res.data) {
            setSelectedErrorLog(res.data);
          }
        })
        .catch(() => {});
    }
  }, [errorIdParam]);

  if (!user?.isSystemAdmin) {
    return (
      <div className="stack">
        <PageHeader title={t("auditLogs.pageTitle")} />
        <Panel>
          <EmptyState
            title="Access Restricted"
            description="System Audit Logs are accessible exclusively to System Administrators."
          />
        </Panel>
      </div>
    );
  }

  // Activity Audit query
  const query = {
    page,
    limit: PAGE_SIZE,
    ...(entity !== "" ? { entity } : {}),
    ...(action !== "" ? { action } : {}),
    ...(search !== "" ? { search } : {}),
    ...(from !== "" ? { from } : {}),
    ...(to !== "" ? { to } : {}),
  };

  const auditResource = useResource<AuditLogListResponse>(
    `audit-logs:${JSON.stringify(query)}`,
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
    <div className="stack" style={{ gap: "1.5rem" }}>
      <PageHeader
        eyebrow="System Administration"
        title={t("auditLogs.pageTitle")}
        description="Comprehensive audit trail of database mutations, system errors, and security investigations."
        actions={
          activeTab === "activity" ? (
            <Button variant="primary" onClick={handleExport}>
              {t("common.exportExcel")} (.xlsx)
            </Button>
          ) : undefined
        }
      />

      {/* Primary Tab Switcher */}
      <div className="audit-page-tabs">
        <button
          type="button"
          onClick={() => handleTabChange("activity")}
          className={`button audit-page-tab-btn ${
            activeTab === "activity" ? "button--primary" : "button--secondary"
          }`}
          style={{
            fontWeight: activeTab === "activity" ? 700 : 500,
          }}
        >
          <ShieldCheck size={17} /> Activity Audit Logs
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("system-errors")}
          className={`button audit-page-tab-btn ${
            activeTab === "system-errors" ? "button--primary" : "button--secondary"
          }`}
          style={{
            fontWeight: activeTab === "system-errors" ? 700 : 500,
            color: activeTab === "system-errors" ? "#ffffff" : "#dc2626",
            borderColor: activeTab === "system-errors" ? "#ef4444" : "rgba(239, 68, 68, 0.35)",
            background: activeTab === "system-errors" ? "#ef4444" : "rgba(239, 68, 68, 0.06)",
          }}
        >
          <AlertTriangle size={17} /> 🚨 System Error Logs (500)
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: Activity Audit Logs                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "activity" && (
        <Panel bleed>
          <div className="audit-filters">
            <label className="audit-filters__field audit-filters__field--search">
              <span className="label">{t("common.search")}</span>
              <input
                type="text"
                className="input"
                placeholder="Search summary, actor, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </label>

            <label className="audit-filters__field">
              <span className="label">Entity</span>
              <select
                className="input select"
                value={entity}
                onChange={(e) => { setParam("entity", e.target.value); setPage(1); }}
              >
                <option value="">All Entities</option>
                {ENTITIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="audit-filters__field">
              <span className="label">Action</span>
              <select
                className="input select"
                value={action}
                onChange={(e) => { setParam("action", e.target.value); setPage(1); }}
              >
                <option value="">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>

            <label className="audit-filters__field">
              <span className="label">From Date</span>
              <input
                type="date"
                className="input"
                value={from}
                onChange={(e) => { setParam("from", e.target.value); setPage(1); }}
              />
            </label>

            <label className="audit-filters__field">
              <span className="label">To Date</span>
              <input
                type="date"
                className="input"
                value={to}
                onChange={(e) => { setParam("to", e.target.value); setPage(1); }}
              />
            </label>

            {hasActiveFilters && (
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "2px" }}>
                <Button variant="ghost" onClick={clearAllFilters} style={{ fontSize: "0.82rem", height: "38px" }}>
                  <RotateCcw size={14} style={{ marginRight: 4 }} /> Clear Filters
                </Button>
              </div>
            )}
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
                      <td data-label="Summary" style={{ maxWidth: "340px", wordBreak: "break-word" }}>
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: System Error Logs (500)                                */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "system-errors" && (
        <Panel bleed>
          <div className="audit-filters">
            <label className="audit-filters__field audit-filters__field--search">
              <span className="label">Search Errors</span>
              <input
                type="text"
                className="input"
                placeholder="Search error, path, user, request ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </label>

            <label className="audit-filters__field">
              <span className="label">From Date</span>
              <input
                type="date"
                className="input"
                value={from}
                onChange={(e) => { setParam("from", e.target.value); setPage(1); }}
              />
            </label>

            <label className="audit-filters__field">
              <span className="label">To Date</span>
              <input
                type="date"
                className="input"
                value={to}
                onChange={(e) => { setParam("to", e.target.value); setPage(1); }}
              />
            </label>

            {hasActiveFilters && (
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "2px" }}>
                <Button variant="ghost" onClick={clearAllFilters} style={{ fontSize: "0.82rem", height: "38px" }}>
                  <RotateCcw size={14} style={{ marginRight: 4 }} /> Clear Filters
                </Button>
              </div>
            )}
          </div>

          {systemErrorsLoading ? (
            <div style={{ textAlign: "center", padding: "4rem" }}>Loading system error records...</div>
          ) : systemErrors.length === 0 ? (
            <div className="panel__pad">
              <EmptyState
                title="No system errors recorded"
                description="Zero 500 internal server errors recorded. All systems are operating normally."
              />
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Timestamp</th>
                    <th scope="col">Status & Error</th>
                    <th scope="col">Endpoint & Method</th>
                    <th scope="col">Initiated By (Culprit)</th>
                    <th scope="col">Role & Org</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {systemErrors.map((err) => (
                    <tr key={err.id}>
                      <td className="numeric" data-label="Timestamp" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                        {new Date(err.createdAt).toLocaleString()}
                      </td>

                      <td data-label="Status & Error">
                        <div className="system-error-title-cell">
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span
                              style={{
                                background: "#ef4444",
                                color: "#ffffff",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "0.1rem 0.4rem",
                                borderRadius: "0.2rem",
                                flexShrink: 0,
                              }}
                            >
                              500
                            </span>
                            <span style={{ fontWeight: 600, fontSize: "0.88rem", wordBreak: "break-word" }}>
                              {err.errorName}
                            </span>
                          </div>
                          <div className="system-error-msg-preview">
                            {err.errorMessage}
                          </div>
                        </div>
                      </td>

                      <td data-label="Endpoint" style={{ fontSize: "0.84rem" }}>
                        <span style={{ fontWeight: 600, marginRight: 4 }}>{err.method}</span>
                        <code style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>{err.path}</code>
                        {err.requestId && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)", wordBreak: "break-all" }}>
                            #{err.requestId}
                          </div>
                        )}
                      </td>

                      <td data-label="Actor">
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {err.userName || (err.userId ? "Authenticated User" : "Anonymous")}
                        </div>
                        {err.userEmail && (
                          <div style={{ fontSize: "0.76rem", color: "var(--ink-soft)", wordBreak: "break-all" }}>
                            {err.userEmail}
                          </div>
                        )}
                      </td>

                      <td data-label="Role & Org" style={{ fontSize: "0.82rem" }}>
                        <div>{err.userRole || "—"}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                          {err.farmName || err.companyName || "System Scope"}
                        </div>
                      </td>

                      <td data-label="Status">
                        {err.resolvedAt ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#16a34a", fontSize: "0.78rem", fontWeight: 600 }}>
                            <CheckCircle size={13} /> Resolved
                          </span>
                        ) : (
                          <span style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600 }}>
                            Unresolved
                          </span>
                        )}
                      </td>

                      <td data-label="Actions">
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedErrorLog(err)}
                          style={{
                            padding: "0.2rem 0.6rem",
                            fontSize: "0.76rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Inspect <ExternalLink size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

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
              fontSize: "0.82rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {JSON.stringify(selectedChanges, null, 2)}
            </pre>
            <div style={{ textAlign: "right", marginTop: "1rem" }}>
              <Button variant="secondary" onClick={() => setSelectedChanges(null)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {/* System Error Inspector Modal */}
      <SystemErrorInspectorModal
        errorItem={selectedErrorLog}
        onClose={() => {
          setSelectedErrorLog(null);
          // Clean errorId param from URL if present
          if (errorIdParam) {
            setParam("errorId", "");
          }
        }}
        onResolved={(updated) => {
          setSelectedErrorLog(updated);
          setSystemErrors((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item)),
          );
        }}
      />
    </div>
  );
}
