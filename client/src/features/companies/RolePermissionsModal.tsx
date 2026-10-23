import { useMemo, useState } from "react";
import { Dialog } from "../../components/Dialog.js";
import { Button } from "../../components/ui.js";
import { Lock, Search, Shield, Sparkles } from "lucide-react";
import type { CompanyRoleConfigItem, Permission } from "../../api/types.js";

interface RolePermissionsModalProps {
  role: CompanyRoleConfigItem | null;
  onClose: () => void;
}

export function RolePermissionsModal({
  role,
  onClose,
}: RolePermissionsModalProps): React.ReactElement | null {
  const [search, setSearch] = useState("");
  const [activeModule, setActiveModule] = useState<string>("ALL");

  const permissions: Permission[] = useMemo(() => {
    return role?.permissions ?? [];
  }, [role]);

  // Group permissions by category (prefix before :)
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const category = p.name.includes(":") ? p.name.split(":")[0] : "general";
      const key = category ? category.charAt(0).toUpperCase() + category.slice(1) : "General";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [permissions]);

  const categories = useMemo(() => {
    return Array.from(grouped.keys()).sort();
  }, [grouped]);

  const filteredPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permissions.filter((p) => {
      const category = p.name.includes(":") ? p.name.split(":")[0] : "general";
      const key = category ? category.charAt(0).toUpperCase() + category.slice(1) : "General";
      const matchesCategory = activeModule === "ALL" || key === activeModule;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [permissions, search, activeModule]);

  if (!role) return null;

  return (
    <Dialog
      title={role.name}
      {...(role.description ? { description: role.description } : {})}
      onClose={onClose}
    >


      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Header Summary */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                {role.name}
              </h3>
              {role.isCompulsory ? (
                <span className="role-tag-badge role-tag-badge--accent">
                  <Lock size={11} /> Compulsory Apex
                </span>
              ) : role.isCustom ? (
                <span className="role-tag-badge role-tag-badge--custom">
                  <Sparkles size={11} /> Custom Role
                </span>
              ) : (
                <span className="role-tag-badge role-tag-badge--standard">
                  <Shield size={11} /> Standard System Role
                </span>
              )}

              <span className="role-tag-badge role-tag-badge--scope">
                {role.scopeLevel === "COMPANY" ? "🏢 Company Level" : "🚜 Farm Level"}
              </span>
            </div>

            {role.description && (
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.88rem", color: "var(--ink-muted, #64748b)", lineHeight: 1.4 }}>
                {role.description}
              </p>
            )}
          </div>

          <div style={{ textAlign: "right", alignSelf: "flex-start", flexShrink: 0 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-muted, #64748b)", display: "block" }}>Granted Access</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-primary, #0284c7)" }}>
              {permissions.length} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>permissions</span>
            </span>
          </div>
        </div>

        {/* Filter bar: search + module tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-muted, #94a3b8)",
              }}
            />
            <input
              type="text"
              placeholder="Search permissions by keyword or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="roles-search-input"
              style={{ width: "100%", paddingLeft: "2.25rem", boxSizing: "border-box" }}
            />
          </div>

          {categories.length > 1 && (
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", overflowX: "auto", paddingBottom: "0.25rem" }}>
              <button
                type="button"
                className={`role-chip-filter ${activeModule === "ALL" ? "role-chip-filter--active" : ""}`}
                onClick={() => setActiveModule("ALL")}
              >
                All Modules ({permissions.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`role-chip-filter ${activeModule === cat ? "role-chip-filter--active" : ""}`}
                  onClick={() => setActiveModule(cat)}
                >
                  {cat} ({grouped.get(cat)?.length ?? 0})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Permissions list */}
        <div
          style={{
            maxHeight: "380px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            paddingRight: "0.25rem",
          }}
        >
          {filteredPermissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--ink-muted, #64748b)", fontSize: "0.9rem" }}>
              {permissions.length === 0
                ? "This role does not have any permissions assigned."
                : "No matching permissions found."}
            </div>
          ) : (
            filteredPermissions.map((perm) => (
              <div
                key={perm.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.6rem 0.85rem",
                  background: "var(--surface-muted, #f8fafc)",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--line, #e2e8f0)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <code
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--color-primary, #0284c7)",
                        background: "rgba(2, 132, 199, 0.08)",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "0.25rem",
                        fontFamily: "monospace",
                      }}
                    >
                      {perm.name}
                    </code>
                  </div>
                  {perm.description && (
                    <div style={{ fontSize: "0.8rem", color: "var(--ink-muted, #64748b)", marginTop: "0.25rem", lineHeight: 1.35 }}>
                      {perm.description}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--line, #e2e8f0)" }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
