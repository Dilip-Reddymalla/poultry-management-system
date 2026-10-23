import { useState } from "react";
import { ApiError } from "../../api/client.js";
import {
  createCompanyCustomRole,
  fetchPermissions,
  updateCompanyCustomRole,
} from "../../api/resources.js";
import type { CompanyRoleConfigItem, Permission } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert, Spinner, TextField } from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface CompanyCustomRoleDialogProps {
  companyId: string;
  role?: CompanyRoleConfigItem | null;
  onClose: () => void;
  onSaved: (role: CompanyRoleConfigItem) => void;
}

export function CompanyCustomRoleDialog({
  companyId,
  role,
  onClose,
  onSaved,
}: CompanyCustomRoleDialogProps): React.ReactElement {
  const isEditing = Boolean(role);
  const permissionsResource = useResource<Permission[]>("permissions", () => fetchPermissions());

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [scopeLevel, setScopeLevel] = useState<"COMPANY" | "FARM">(
    (role?.scopeLevel as "COMPANY" | "FARM") || "COMPANY",
  );
  const [rank, setRank] = useState(role?.rank ?? 30);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(
    new Set((role?.permissions ?? []).map((p) => p.id)),
  );
  const [permissionFilter, setPermissionFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const permissions = permissionsResource.data ?? [];

  // Group permissions by prefix (e.g. employee:view -> group "Employee")
  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const raw = p.name.includes(":") ? p.name.split(":")[0] : "general";
    const group = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "General";
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
        const response = await updateCompanyCustomRole(companyId, role.id, {
          name: name.trim(),
          ...(desc ? { description: desc } : {}),
          scopeLevel,
          permissionIds: Array.from(selectedPermissionIds),
          rank: Number(rank),
        });
        onSaved(response.role);
      } else {
        const response = await createCompanyCustomRole(companyId, {
          name: name.trim(),
          ...(desc ? { description: desc } : {}),
          scopeLevel,
          permissionIds: Array.from(selectedPermissionIds),
          rank: Number(rank),
        });
        onSaved(response.role);
      }
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught);
      else setError(new ApiError(500, "Unexpected error saving role."));
    } finally {
      setBusy(false);
    }
  }

  const q = permissionFilter.trim().toLowerCase();

  return (
    <Dialog
      onClose={onClose}
      title={isEditing ? `Edit Role: ${role?.name}` : "Create Enterprise Custom Role"}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && <FormAlert error={error} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "1rem" }}>
          <TextField
            id="custom-role-name"
            label="Role / Designation Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Operations Coordinator, Chief Auditor"
            required
            autoFocus
          />


          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--ink, #0f172a)",
                marginBottom: "0.35rem",
              }}
            >
              Default Rank (1-100)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={rank}
              onChange={(e) => setRank(Number(e.target.value))}
              className="roles-search-input"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--ink, #0f172a)",
              marginBottom: "0.35rem",
            }}
          >
            Scope Level
          </label>
          <div style={{ display: "flex", gap: "1rem" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.88rem" }}>
              <input
                type="radio"
                name="scopeLevel"
                value="COMPANY"
                checked={scopeLevel === "COMPANY"}
                onChange={() => setScopeLevel("COMPANY")}
              />
              🏢 Company-Wide (Enterprise Level)
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.88rem" }}>
              <input
                type="radio"
                name="scopeLevel"
                value="FARM"
                checked={scopeLevel === "FARM"}
                onChange={() => setScopeLevel("FARM")}
              />
              🚜 Farm-Specific (Applied within Farm)
            </label>
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--ink, #0f172a)",
              marginBottom: "0.35rem",
            }}
          >
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize this role's responsibilities across the organization..."
            rows={2}
            className="roles-search-input"
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
        </div>

        {/* Permissions Section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
              Role Permissions ({selectedPermissionIds.size} granted)
            </label>
            <input
              type="text"
              placeholder="Search permissions…"
              value={permissionFilter}
              onChange={(e) => setPermissionFilter(e.target.value)}
              className="roles-search-input"
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", width: "180px" }}
            />
          </div>

          {permissionsResource.loading ? (
            <div style={{ padding: "1.5rem", textAlign: "center" }}>
              <Spinner />
            </div>
          ) : (

            <div
              style={{
                maxHeight: "280px",
                overflowY: "auto",
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                background: "var(--surface-muted, #f8fafc)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {Object.entries(grouped).map(([groupName, groupPerms]) => {
                const filtered = q
                  ? groupPerms.filter(
                      (p) =>
                        p.name.toLowerCase().includes(q) ||
                        (p.description && p.description.toLowerCase().includes(q)),
                    )
                  : groupPerms;

                if (filtered.length === 0) return null;

                const allInGroup = groupPerms.every((p) => selectedPermissionIds.has(p.id));
                const someInGroup = groupPerms.some((p) => selectedPermissionIds.has(p.id));

                return (
                  <div
                    key={groupName}
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--line, #e2e8f0)",
                      borderRadius: "0.375rem",
                      padding: "0.5rem 0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid var(--line, #f1f5f9)",
                        paddingBottom: "0.35rem",
                        marginBottom: "0.4rem",
                      }}
                    >
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                        {groupName}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupPerms)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-primary, #0284c7)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {allInGroup ? "Deselect All" : someInGroup ? "Select Remaining" : "Select All"}
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.35rem" }}>
                      {filtered.map((perm) => (
                        <label
                          key={perm.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            fontSize: "0.78rem",
                            color: "var(--ink, #334155)",
                            cursor: "pointer",
                            padding: "0.15rem 0.25rem",
                            borderRadius: "0.25rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissionIds.has(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            style={{ accentColor: "var(--color-primary, #0284c7)" }}
                          />
                          <span title={perm.description ?? perm.name} style={{ wordBreak: "break-all" }}>
                            {perm.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dialog Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--line, #e2e8f0)" }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : isEditing ? "Save Changes" : "Create Custom Role"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
