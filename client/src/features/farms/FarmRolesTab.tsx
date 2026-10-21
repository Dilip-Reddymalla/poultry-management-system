import { useState } from "react";
import { ApiError } from "../../api/client.js";
import {
  deleteFarmCustomRole,
  fetchFarmRolesConfig,
  toggleFarmSystemRole,
} from "../../api/resources.js";
import type {
  CustomRoleConfigItem,
  FarmRolesConfigResponse,
  SystemRoleConfigItem,
} from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { ConfirmDialog } from "../../components/Dialog.js";
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Panel,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { CustomRoleDialog } from "./CustomRoleDialog.js";

interface FarmRolesTabProps {
  farmId: string;
}

export function FarmRolesTab({ farmId }: FarmRolesTabProps): React.ReactElement {
  const { can } = useAuth();
  const { notify } = useToast();
  const canManage = can("farm:update");

  const configResource = useResource<FarmRolesConfigResponse>(
    `farm-roles-config:${farmId}`,
    () => fetchFarmRolesConfig(farmId),
  );

  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [roleToEdit, setRoleToEdit] = useState<CustomRoleConfigItem | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<CustomRoleConfigItem | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const data = configResource.data;

  async function handleToggle(role: SystemRoleConfigItem): Promise<void> {
    if (!canManage || togglingRoleId) return;
    const nextState = !role.isEnabled;
    setTogglingRoleId(role.id);

    try {
      await toggleFarmSystemRole(farmId, role.id, nextState);
      notify("success", `${role.name} is now ${nextState ? "enabled" : "disabled"} for this farm.`);
      configResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to update role status.");
    } finally {
      setTogglingRoleId(null);
    }
  }

  async function handleDeleteRole(): Promise<void> {
    if (!roleToDelete) return;
    setDeletingBusy(true);

    try {
      await deleteFarmCustomRole(farmId, roleToDelete.id);
      notify("success", `Role "${roleToDelete.name}" deleted successfully.`);
      setRoleToDelete(null);
      configResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to delete role.");
    } finally {
      setDeletingBusy(false);
    }
  }

  if (configResource.loading) {
    return <CardSkeleton />;
  }

  if (configResource.error || !data) {
    return (
      <ErrorState
        error={configResource.error ?? new ApiError(500, "Failed to load roles configuration.")}
        onRetry={configResource.reload}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {/* 1. Custom Farm Roles */}
      <Panel
        title="Custom Farm Roles"
        eyebrow="Location Specific"
        actions={
          canManage ? (
            <Button
              variant="primary"
              onClick={() => setShowCreateDialog(true)}
            >
              + Add Custom Role
            </Button>
          ) : null
        }
      >
        <p style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Tailored roles created specifically for this farm's unique duties and staffing structure.
        </p>

        {data.customRoles.length === 0 ? (
          <EmptyState
            title="No custom roles yet"
            description="Create custom operational roles if your farm requires specialized duties not covered by standard roles."
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "1rem" }}>
            {data.customRoles.map((role) => (
              <div
                key={role.id}
                style={{
                  border: "1px solid var(--line, #e5e7eb)",
                  borderRadius: "10px",
                  padding: "1rem",
                  backgroundColor: "var(--surface, #fff)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{role.name}</h3>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(46, 125, 50, 0.12)",
                        color: "var(--moss, #2e7d32)",
                      }}
                    >
                      Rank {role.rank}
                    </span>
                  </div>
                  {role.description && (
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-muted, #64748b)", margin: "0.25rem 0 0.5rem" }}>
                      {role.description}
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.5rem" }}>
                    {role.permissions.map((p) => (
                      <span
                        key={p.id}
                        style={{
                          fontSize: "0.68rem",
                          backgroundColor: "var(--surface-sunken, #f3f4f6)",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          color: "var(--ink-secondary, #475569)",
                        }}
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "1rem",
                    paddingTop: "0.6rem",
                    borderTop: "1px solid var(--line, #f1f5f9)",
                    fontSize: "0.78rem",
                    color: "var(--ink-muted, #64748b)",
                  }}
                >
                  <span>{role.userCount} user(s) assigned</span>
                  {canManage && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => setRoleToEdit(role)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--moss, #2e7d32)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoleToDelete(role)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--crimson, #dc2626)",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* 2. Inherited Company Roles (Toggleable catalogue) */}
      <Panel
        title="Inherited Company Roles"
        eyebrow="Inherited from Company"
      >
        <p style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          These standard generic roles have been enabled by your company admin. This farm inherits these common roles and can optionally adjust their enablement locally.
        </p>

        {data.systemRoles.length === 0 ? (
          <EmptyState
            title="No standard roles inherited"
            description="Your company admin has not enabled any generic roles yet. They can be selected in the Company Roles section."
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "0.75rem" }}>
            {data.systemRoles.map((role) => {
              const isToggling = togglingRoleId === role.id;
              return (
                <div
                  key={role.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--line, #e5e7eb)",
                    borderRadius: "8px",
                    backgroundColor: role.isEnabled ? "var(--surface, #fff)" : "var(--surface-sunken, #f9fafb)",
                    opacity: role.isEnabled ? 1 : 0.65,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{role.name}</strong>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          backgroundColor: "rgba(2, 132, 199, 0.1)",
                          color: "var(--color-primary, #0284c7)",
                          fontWeight: 600,
                        }}
                      >
                        Inherited
                      </span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          backgroundColor: "var(--surface-muted, #e2e8f0)",
                          color: "var(--ink-muted, #475569)",
                          fontWeight: 600,
                        }}
                      >
                        {role.scopeLevel}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-muted, #64748b)", display: "block" }}>
                      {role.permissionCount} permissions · Rank {role.rank}
                    </span>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggle(role)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        border: "1px solid",
                        cursor: isToggling ? "wait" : "pointer",
                        backgroundColor: role.isEnabled ? "rgba(46, 125, 50, 0.12)" : "rgba(100, 116, 139, 0.12)",
                        borderColor: role.isEnabled ? "var(--moss, #2e7d32)" : "var(--ink-muted, #94a3b8)",
                        color: role.isEnabled ? "var(--moss, #2e7d32)" : "var(--ink-muted, #64748b)",
                      }}
                    >
                      {isToggling ? "…" : role.isEnabled ? "✓ Enabled" : "Disabled"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Create / Edit Dialog */}
      {(showCreateDialog || roleToEdit) && (
        <CustomRoleDialog
          farmId={farmId}
          role={roleToEdit}
          onClose={() => {
            setShowCreateDialog(false);
            setRoleToEdit(null);
          }}
          onSaved={() => {
            setShowCreateDialog(false);
            setRoleToEdit(null);
            notify("success", roleToEdit ? "Role updated successfully." : "Custom role created successfully.");
            configResource.reload();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {roleToDelete && (
        <ConfirmDialog
          title={`Delete custom role "${roleToDelete.name}"?`}
          description="Are you sure you want to delete this custom role? This action cannot be undone."
          confirmLabel="Delete Role"
          confirmVariant="danger"
          busy={deletingBusy}
          onConfirm={() => {
            void handleDeleteRole();
          }}
          onClose={() => setRoleToDelete(null)}
        />
      )}
    </div>
  );
}
