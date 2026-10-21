import { useState } from "react";
import { ApiError } from "../../api/client.js";
import {
  bulkToggleCompanyRoles,
  fetchCompanyRolesConfig,
  toggleCompanyRole,
  updateCompanyRole,
} from "../../api/resources.js";
import type {
  CompanyRoleConfigItem,
  CompanyRolesConfigResponse,
} from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Panel,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import "./RolesConfig.css";

function RoleBadge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "primary" | "active" | "inactive" | "accent";
}): React.ReactElement {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "rgba(2, 132, 199, 0.12)",
      color: "var(--color-primary, #0284c7)",
      border: "1px solid rgba(2, 132, 199, 0.25)",
    },
    active: {
      background: "rgba(34, 197, 94, 0.12)",
      color: "#16a34a",
      border: "1px solid rgba(34, 197, 94, 0.25)",
    },
    inactive: {
      background: "rgba(100, 116, 139, 0.12)",
      color: "#64748b",
      border: "1px solid rgba(100, 116, 139, 0.25)",
    },
    accent: {
      background: "rgba(124, 58, 237, 0.12)",
      color: "#7c3aed",
      border: "1px solid rgba(124, 58, 237, 0.25)",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "0.15rem 0.45rem",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

interface EditCustomRankDialogProps {
  role: CompanyRoleConfigItem;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}

function EditCustomRankDialog({
  role,
  companyId,
  onClose,
  onSaved,
}: EditCustomRankDialogProps): React.ReactElement {
  const { notify } = useToast();
  const [rankValue, setRankValue] = useState<number>(role.rank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(newRank: number | null): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await updateCompanyRole(companyId, role.id, { customRank: newRank });
      notify(
        "success",
        newRank !== null
          ? `Custom rank of ${newRank} applied for ${role.name}.`
          : `Reset ${role.name} rank to system default (${role.defaultRank}).`,
      );
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Failed to update rank.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={`Custom Rank: ${role.name}`}
      description="Configure a company-specific hierarchy rank for this role. Hierarchy ranks (1 - 100) define authority and delegation levels across all farms in your company."
      onClose={onClose}
    >
      <form
        className="dialog__form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(rankValue);
        }}
      >
        {error ? (
          <div
            style={{
              padding: "0.6rem 0.8rem",
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              borderRadius: "0.375rem",
              color: "#dc2626",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "0.35rem",
              color: "var(--ink, #0f172a)",
            }}
          >
            Custom Company Rank (1 - 100)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            required
            value={rankValue}
            onChange={(e) => setRankValue(Number(e.target.value))}
            className="text-input"
            style={{
              width: "100%",
              padding: "0.55rem 0.75rem",
              fontSize: "1rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--line, #cbd5e1)",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.4rem",
              fontSize: "0.8rem",
              color: "var(--ink-muted, #64748b)",
              flexWrap: "wrap",
              gap: "0.25rem",
            }}
          >
            <span>
              System Default: <strong>{role.defaultRank}</strong>
            </span>
            {role.customRank !== null && (
              <span style={{ color: "var(--color-primary, #0284c7)", fontWeight: 600 }}>
                Customized: {role.customRank}
              </span>
            )}
          </div>
        </div>

        <div
          className="dialog__actions"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            borderTop: "1px solid var(--line, #e2e8f0)",
            paddingTop: "1rem",
          }}
        >
          <div>
            {role.customRank !== null && (
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => handleSave(null)}
              >
                Reset to Default
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save Rank"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

interface CompanyRolesTabProps {
  companyId: string;
}

export function CompanyRolesTab({ companyId }: CompanyRolesTabProps): React.ReactElement {
  const { can } = useAuth();
  const { notify } = useToast();
  const canManage = can("company:update");

  const configResource = useResource<CompanyRolesConfigResponse>(
    `company-roles-config:${companyId}`,
    () => fetchCompanyRolesConfig(companyId),
  );

  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [editingRankRole, setEditingRankRole] = useState<CompanyRoleConfigItem | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "COMPANY" | "FARM">("ALL");

  const data = configResource.data;

  async function handleToggle(role: CompanyRoleConfigItem): Promise<void> {
    if (!canManage || togglingRoleId || role.isCompulsory) return;
    const nextState = !role.isEnabled;
    setTogglingRoleId(role.id);

    try {
      await toggleCompanyRole(companyId, role.id, nextState);
      notify("success", `${role.name} is now ${nextState ? "enabled" : "disabled"} for this company.`);
      configResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to update role status.");
    } finally {
      setTogglingRoleId(null);
    }
  }

  async function handleBulkToggle(enableAll: boolean): Promise<void> {
    if (!canManage || bulkBusy) return;
    setBulkBusy(true);

    try {
      await bulkToggleCompanyRoles(companyId, enableAll);
      notify("success", `All optional roles have been ${enableAll ? "enabled" : "disabled"}.`);
      configResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to update roles.");
    } finally {
      setBulkBusy(false);
    }
  }

  if (configResource.loading) {
    return <CardSkeleton />;
  }

  if (configResource.error || !data) {
    return (
      <ErrorState
        error={configResource.error ?? new ApiError(500, "Failed to load company roles configuration.")}
        onRetry={configResource.reload}
      />
    );
  }

  const systemRoles = data.systemRoles ?? [];

  const filteredRoles = systemRoles.filter((role) => {
    const matchesSearch =
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(search.toLowerCase()));

    const matchesScope =
      scopeFilter === "ALL" || role.scopeLevel === scopeFilter;

    return matchesSearch && matchesScope;
  });

  const enabledCount = systemRoles.filter((r) => r.isEnabled).length;
  const totalCount = systemRoles.length;

  return (
    <div className="roles-config-container">
      <Panel
        title="Enterprise Standard Roles"
        eyebrow="Inheritance Architecture"
        actions={
          canManage ? (
            <div className="roles-header-actions">
              <Button
                variant="secondary"
                disabled={bulkBusy}
                onClick={() => handleBulkToggle(true)}
              >
                {bulkBusy ? "Updating…" : "Enable All Optional"}
              </Button>
              <Button
                variant="ghost"
                disabled={bulkBusy}
                onClick={() => handleBulkToggle(false)}
              >
                Disable All Optional
              </Button>
            </div>
          ) : null
        }
      >
        <p style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
          Select the common generic roles needed for your enterprise. All farms under this company will{" "}
          <strong style={{ color: "var(--ink, #0f172a)" }}>inherit</strong> only the enabled roles.
          You can also configure custom hierarchy ranks for each role to fit your organizational structure.
        </p>

        {/* Stats summary & Filter bar */}
        <div className="roles-toolbar">
          <div className="roles-toolbar__stats">
            <div>
              <span className="roles-toolbar__stat-label">
                Active Company Roles
              </span>
              <span className="roles-toolbar__stat-val">
                {enabledCount} <span className="roles-toolbar__stat-sub">/ {totalCount} standard roles</span>
              </span>
            </div>
            <div className="roles-toolbar__divider" />
            <div>
              <span className="roles-toolbar__stat-label">
                Compulsory Role
              </span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink, #0f172a)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                Company Admin <RoleBadge variant="accent">🔒 Locked</RoleBadge>
              </span>
            </div>
          </div>

          {/* Search and Scope Filter */}
          <div className="roles-toolbar__filters">
            <input
              type="text"
              placeholder="Search roles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="roles-search-input"
            />
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="roles-scope-select"
            >
              <option value="ALL">All Scopes</option>
              <option value="COMPANY">🏢 Company Level</option>
              <option value="FARM">🚜 Farm Level</option>
            </select>
          </div>
        </div>

        {/* Roles Grid */}
        {filteredRoles.length === 0 ? (
          <EmptyState
            title="No matching roles"
            description="Try adjusting your search query or scope filter."
          />
        ) : (
          <div className="roles-grid">
            {filteredRoles.map((role) => {
              const isBusy = togglingRoleId === role.id;
              const isCompulsory = role.isCompulsory;
              const hasCustomRank = role.customRank !== null;

              return (
                <div
                  key={role.id}
                  className={[
                    "role-card",
                    isCompulsory ? "role-card--compulsory" : "",
                    !role.isEnabled ? "role-card--disabled" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <div>
                    {/* Header: Name, Scope, Status */}
                    <div className="role-card__header">
                      <div className="role-card__title-group">
                        <h4 className="role-card__name">
                          {role.name}
                        </h4>
                        <div className="role-card__badges">
                          {isCompulsory ? (
                            <RoleBadge variant="accent">🔒 Compulsory & Default</RoleBadge>
                          ) : role.isEnabled ? (
                            <RoleBadge variant="active">✓ Active for Company</RoleBadge>
                          ) : (
                            <RoleBadge variant="inactive">Disabled</RoleBadge>
                          )}
                          <span className="role-card__scope-tag">
                            {role.scopeLevel === "COMPANY" ? "🏢 Company Level" : "🚜 Farm Level"}
                          </span>
                        </div>
                      </div>

                      {/* Rank badge with interactive Edit button */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <span className="role-card__rank-badge" title={`Rank ${role.rank}${hasCustomRank ? ` (Custom - Default was ${role.defaultRank})` : " (Default)"}`}>
                            Rank {role.rank}
                          </span>
                          {hasCustomRank && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                color: "#7c3aed",
                                background: "rgba(124, 58, 237, 0.1)",
                                padding: "0.15rem 0.35rem",
                                borderRadius: "0.25rem",
                              }}
                            >
                              Custom
                            </span>
                          )}
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setEditingRankRole(role)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--color-primary, #0284c7)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              padding: "0.1rem 0.3rem",
                              textDecoration: "underline",
                              fontWeight: 500,
                            }}
                          >
                            Edit Rank
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="role-card__desc">
                      {role.description || "Operational role with predefined system permissions."}
                    </p>
                  </div>

                  {/* Footer: Permission count & Enabled Toggle */}
                  <div className="role-card__footer">
                    <span className="role-card__perms">
                      🔑 {role.permissionCount} permissions
                    </span>

                    {/* Compulsory indicator or interactive checkbox */}
                    {isCompulsory ? (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "var(--color-primary, #0284c7)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                        title="Company Admin is compulsory and cannot be disabled"
                      >
                        🔒 Always Selected
                      </span>
                    ) : (
                      <label
                        className={[
                          "role-card__toggle-label",
                          !canManage || isBusy ? "role-card__toggle-label--disabled" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ color: role.isEnabled ? "var(--ink, #0f172a)" : "var(--ink-muted, #94a3b8)" }}
                      >
                        <span>{isBusy ? "Saving…" : role.isEnabled ? "Enabled" : "Disabled"}</span>
                        <input
                          type="checkbox"
                          className="role-card__toggle-input"
                          checked={role.isEnabled}
                          disabled={!canManage || isBusy}
                          onChange={() => handleToggle(role)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Edit Custom Rank Dialog */}
      {editingRankRole && (
        <EditCustomRankDialog
          role={editingRankRole}
          companyId={companyId}
          onClose={() => setEditingRankRole(null)}
          onSaved={() => {
            setEditingRankRole(null);
            configResource.reload();
          }}
        />
      )}
    </div>
  );
}
