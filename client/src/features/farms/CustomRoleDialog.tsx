import { useState } from "react";
import { ApiError } from "../../api/client.js";
import {
  createFarmCustomRole,
  updateFarmCustomRole,
  fetchPermissions,
} from "../../api/resources.js";
import type { CustomRoleConfigItem, Permission } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface CustomRoleDialogProps {
  farmId: string;
  role?: CustomRoleConfigItem | null;
  onClose: () => void;
  onSaved: (role: CustomRoleConfigItem) => void;
}

export function CustomRoleDialog({
  farmId,
  role,
  onClose,
  onSaved,
}: CustomRoleDialogProps): React.ReactElement {
  const isEditing = Boolean(role);
  const permissionsResource = useResource<Permission[]>("permissions", () => fetchPermissions());

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [rank, setRank] = useState(role?.rank ?? 30);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(
    new Set((role?.permissions ?? []).map((p) => p.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const permissions = permissionsResource.data ?? [];

  // Group permissions by prefix (e.g. employee:view -> group "employee")
  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const group = p.name.split(":")[0] || "general";
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  function togglePermission(id: string): void {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupPermissions: Permission[]): void {
    const allSelected = groupPermissions.every((p) => selectedPermissionIds.has(p.id));
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      for (const p of groupPermissions) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!name.trim()) return;

    setBusy(true);
    setError(null);

    try {
      const desc = description.trim();
      if (isEditing && role) {
        const updated = await updateFarmCustomRole(farmId, role.id, {
          name: name.trim(),
          ...(desc ? { description: desc } : {}),
          permissionIds: Array.from(selectedPermissionIds),
          rank: Number(rank),
        });
        onSaved(updated);
      } else {
        const created = await createFarmCustomRole(farmId, {
          name: name.trim(),
          ...(desc ? { description: desc } : {}),
          permissionIds: Array.from(selectedPermissionIds),
          rank: Number(rank),
        });
        onSaved(created);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught : new ApiError(0, "Failed to save role."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={isEditing ? `Edit Custom Role: ${role?.name}` : "Create Custom Role"}
      description="Define a specialized operational role with custom permissions for this farm."
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {permissionsResource.error ? <FormAlert error={permissionsResource.error} /> : null}

        <TextField
          id="custom-role-name"
          label="Role Name"
          required
          value={name}
          placeholder="e.g. Broiler Health Specialist"
          errors={error?.fieldErrors.name}
          onChange={(event) => setName(event.target.value)}
        />

        <TextField
          id="custom-role-desc"
          label="Description (Optional)"
          value={description}
          placeholder="Brief summary of duties and responsibilities"
          errors={error?.fieldErrors.description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="field">
          <label htmlFor="custom-role-rank" className="field__label">
            Hierarchy Rank: <strong>{rank}</strong>
          </label>
          <input
            id="custom-role-rank"
            type="range"
            min="10"
            max="80"
            step="5"
            value={rank}
            onChange={(e) => setRank(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--moss, #2e7d32)" }}
          />
          <span className="field__hint">
            Defines supervisory rank (Worker is 10, Supervisor is 50, Incharge is 60, DGM is 80).
          </span>
        </div>

        <div className="field">
          <span className="field__label">
            Role Permissions ({selectedPermissionIds.size} selected)
          </span>

          {permissionsResource.loading ? (
            <p className="field__hint">
              <Spinner label="Loading permissions" /> Loading permissions…
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
                maxHeight: "320px",
                overflowY: "auto",
                border: "1px solid var(--line, #e5e7eb)",
                borderRadius: "8px",
                padding: "0.75rem",
                backgroundColor: "var(--surface-sunken, #f9fafb)",
              }}
            >
              {Object.entries(grouped).map(([group, groupPerms]) => {
                const groupSelectedCount = groupPerms.filter((p) =>
                  selectedPermissionIds.has(p.id),
                ).length;
                const allSelected = groupSelectedCount === groupPerms.length;

                return (
                  <div
                    key={group}
                    style={{
                      borderBottom: "1px solid var(--line, #e5e7eb)",
                      paddingBottom: "0.6rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <strong
                        style={{
                          textTransform: "uppercase",
                          fontSize: "0.75rem",
                          letterSpacing: "0.05em",
                          color: "var(--ink-muted, #64748b)",
                        }}
                      >
                        {group} ({groupSelectedCount}/{groupPerms.length})
                      </strong>
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupPerms)}
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--moss, #2e7d32)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: "0.35rem",
                      }}
                    >
                      {groupPerms.map((p) => {
                        const checked = selectedPermissionIds.has(p.id);
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "0.45rem",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              padding: "0.2rem 0.35rem",
                              borderRadius: "4px",
                              backgroundColor: checked ? "rgba(46, 125, 50, 0.08)" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(p.id)}
                              style={{ marginTop: "0.15rem", accentColor: "var(--moss, #2e7d32)" }}
                            />
                            <div>
                              <span style={{ fontWeight: checked ? 600 : 400 }}>{p.name}</span>
                              {p.description && (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: "0.68rem",
                                    color: "var(--ink-muted, #64748b)",
                                  }}
                                >
                                  {p.description}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? <Spinner label="Saving…" /> : isEditing ? "Save Changes" : "Create Role"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
