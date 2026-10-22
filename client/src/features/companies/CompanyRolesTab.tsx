import { useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Link2,
  Lock,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react";
import { ApiError } from "../../api/client.js";
import {
  fetchCompanyRolesConfig,
  updateCompanyRolesHierarchy,
} from "../../api/resources.js";
import type {
  CompanyRoleConfigItem,
  CompanyRolesConfigResponse,
} from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Panel,
} from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import type { HierarchyItem } from "./hierarchy-utils.js";
import {
  calculateSmoothedRanks,
  initializeHierarchy,
} from "./hierarchy-utils.js";
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

  const [hierarchyItems, setHierarchyItems] = useState<HierarchyItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "COMPANY" | "FARM">("ALL");

  const data = configResource.data;
  const systemRoles = useMemo(() => data?.systemRoles ?? [], [data]);

  // Initialize or re-sync local hierarchy when remote data is loaded
  useEffect(() => {
    if (systemRoles.length > 0) {
      const initialized = initializeHierarchy(systemRoles);
      setHierarchyItems(initialized);
      setInitialSnapshot(
        JSON.stringify(
          initialized.map((item) => ({ id: item.id, sameAsPrevious: item.sameAsPrevious })),
        ),
      );
    }
  }, [systemRoles]);

  // Live auto-calculated smoothed ranks
  const computedRanks = useMemo(() => {
    return calculateSmoothedRanks(hierarchyItems);
  }, [hierarchyItems]);

  // Check if there are unsaved local modifications
  const currentSnapshot = useMemo(() => {
    return JSON.stringify(
      hierarchyItems.map((item) => ({ id: item.id, sameAsPrevious: item.sameAsPrevious })),
    );
  }, [hierarchyItems]);

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return currentSnapshot !== initialSnapshot;
  }, [currentSnapshot, initialSnapshot]);

  // Quick lookup set of active role IDs in hierarchy
  const activeRoleIds = useMemo(() => {
    return new Set(hierarchyItems.map((item) => item.id));
  }, [hierarchyItems]);

  // Toggle role in/out of the hierarchy canvas
  function handleToggleRoleInPool(role: CompanyRoleConfigItem): void {
    if (!canManage || role.isCompulsory) return;

    if (activeRoleIds.has(role.id)) {
      handleRemoveRole(role.id);
    } else {
      setHierarchyItems((prev) => [
        ...prev,
        {
          id: role.id,
          role: { ...role, isEnabled: true },
          sameAsPrevious: false,
        },
      ]);
    }
  }

  // Remove role from hierarchy canvas
  function handleRemoveRole(roleId: string): void {
    if (!canManage) return;

    setHierarchyItems((prev) => {
      const idx = prev.findIndex((item) => item.id === roleId);
      const targetItem = prev[idx];
      if (idx === -1 || !targetItem || targetItem.role.isCompulsory) return prev;

      const next = prev.filter((item) => item.id !== roleId);
      const followingItem = next[idx];
      if (followingItem && followingItem.sameAsPrevious) {
        next[idx] = { ...followingItem, sameAsPrevious: false };
      }
      return next;
    });
  }

  // Toggle peer rank with the role directly above
  function handleTogglePeerRank(index: number): void {
    if (!canManage || index <= 0) return;

    setHierarchyItems((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const copy = [...prev];
      copy[index] = {
        ...target,
        sameAsPrevious: !target.sameAsPrevious,
      };
      return copy;
    });
  }

  // Reorder via framer-motion drag
  function handleReorder(newOrder: HierarchyItem[]): void {
    if (!canManage) return;

    const adminIdx = newOrder.findIndex((item) => item.role.isCompulsory);
    if (adminIdx > 0) {
      const adminItem = newOrder[adminIdx];
      if (adminItem) {
        newOrder.splice(adminIdx, 1);
        newOrder.unshift(adminItem);
      }
    }

    const first = newOrder[0];
    if (first && first.sameAsPrevious) {
      newOrder[0] = { ...first, sameAsPrevious: false };
    }

    setHierarchyItems(newOrder);
  }

  // Accessible micro-move up / down
  function handleMove(index: number, direction: "up" | "down"): void {
    if (!canManage) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 1 || targetIndex >= hierarchyItems.length || index < 1) return;

    setHierarchyItems((prev) => {
      const itemA = prev[index];
      const itemB = prev[targetIndex];
      if (!itemA || !itemB) return prev;

      const copy = [...prev];
      copy[index] = { ...itemB, sameAsPrevious: false };
      copy[targetIndex] = { ...itemA, sameAsPrevious: false };
      return copy;
    });
  }

  // Reset local state to fetched server configuration
  function handleReset(): void {
    const initialized = initializeHierarchy(systemRoles);
    setHierarchyItems(initialized);
  }

  // Select all or remove all optional roles
  function handleBulkSelect(selectAll: boolean): void {
    if (!canManage) return;

    if (selectAll) {
      const currentlyActive = new Set(hierarchyItems.map((item) => item.id));
      const newlyAdded: HierarchyItem[] = [];

      systemRoles.forEach((role) => {
        if (!currentlyActive.has(role.id)) {
          newlyAdded.push({
            id: role.id,
            role: { ...role, isEnabled: true },
            sameAsPrevious: false,
          });
        }
      });

      setHierarchyItems((prev) => [...prev, ...newlyAdded]);
    } else {
      setHierarchyItems((prev) => prev.filter((item) => item.role.isCompulsory));
    }
  }

  // Save hierarchy order and calculated ranks to database
  async function handleSaveHierarchy(): Promise<void> {
    if (!canManage || isSaving) return;
    setIsSaving(true);

    try {
      const activePayload = hierarchyItems.map((item) => ({
        roleId: item.id,
        isEnabled: true,
        customRank: computedRanks.get(item.id) ?? 50,
      }));

      const activeIds = new Set(hierarchyItems.map((item) => item.id));
      const inactivePayload = systemRoles
        .filter((r) => !activeIds.has(r.id))
        .map((r) => ({
          roleId: r.id,
          isEnabled: false,
          customRank: null,
        }));

      const fullPayload = [...activePayload, ...inactivePayload];

      await updateCompanyRolesHierarchy(companyId, fullPayload);
      notify("success", "Role hierarchy and smoothed ranks updated successfully.");
      configResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to save hierarchy.");
    } finally {
      setIsSaving(false);
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

  const filteredPoolRoles = systemRoles.filter((role) => {
    const matchesSearch =
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(search.toLowerCase()));

    const matchesScope = scopeFilter === "ALL" || role.scopeLevel === scopeFilter;

    return matchesSearch && matchesScope;
  });

  const enabledCount = hierarchyItems.length;
  const totalCount = systemRoles.length;

  return (
    <div className="roles-config-container">
      <Panel
        title="Enterprise Role Hierarchy Studio"
        eyebrow="Inheritance & Rank Architecture"
        actions={
          canManage ? (
            <div className="roles-header-actions">
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => handleBulkSelect(true)}
              >
                Select All Standard Roles
              </Button>
              <Button
                variant="ghost"
                disabled={isSaving}
                onClick={() => handleBulkSelect(false)}
              >
                Deselect Optional
              </Button>
            </div>
          ) : null
        }
      >
        <p style={{ color: "var(--ink-muted, #64748b)", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
          Select the operational roles needed for your enterprise, then arrange them in the hierarchy canvas below.
          Drag cards to position authority levels, or link roles to give them the <strong>exact same rank</strong>.
          Ranks are automatically calculated and smoothed across all enterprise farms.
        </p>

        {/* Toolbar Stats */}
        <div className="roles-toolbar">
          <div className="roles-toolbar__stats">
            <div>
              <span className="roles-toolbar__stat-label">Active Hierarchy</span>
              <span className="roles-toolbar__stat-val">
                {enabledCount} <span className="roles-toolbar__stat-sub">/ {totalCount} standard roles</span>
              </span>
            </div>
            <div className="roles-toolbar__divider" />
            <div>
              <span className="roles-toolbar__stat-label">Compulsory Apex Role</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink, #0f172a)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                Company Admin <RoleBadge variant="accent">🔒 Locked at Apex</RoleBadge>
              </span>
            </div>
          </div>
        </div>

        {/* Studio Dual-Pane Layout */}
        <div className="roles-studio">
          {/* Left Pane: Role Selection Catalog */}
          <div className="roles-studio__pool">
            <div className="pool-header">
              <h3 className="pool-header__title">
                Available Roles Catalog
              </h3>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-muted, #64748b)" }}>
                {filteredPoolRoles.length} roles
              </span>
            </div>

            <div className="pool-search">
              <input
                type="text"
                placeholder="Search roles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="roles-search-input"
                style={{ width: "100%" }}
              />
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as any)}
                className="roles-scope-select"
                style={{ width: "100%" }}
              >
                <option value="ALL">All Scopes</option>
                <option value="COMPANY">🏢 Company Level</option>
                <option value="FARM">🚜 Farm Level</option>
              </select>
            </div>

            <div className="pool-list">
              {filteredPoolRoles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--ink-muted, #64748b)", fontSize: "0.85rem" }}>
                  No matching roles found.
                </div>
              ) : (
                filteredPoolRoles.map((role) => {
                  const isActive = activeRoleIds.has(role.id);
                  const isCompulsory = role.isCompulsory;

                  return (
                    <div
                      key={role.id}
                      className={[
                        "pool-item",
                        isActive ? "pool-item--active" : "",
                        isCompulsory ? "pool-item--compulsory" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <div className="pool-item__info">
                        <div className="pool-item__name">
                          {role.name}
                          {isCompulsory && (
                            <span title="Company Admin is always active at Apex">
                              <Lock size={12} color="#7c3aed" />
                            </span>
                          )}
                        </div>
                        <div className="pool-item__sub">
                          {role.scopeLevel === "COMPANY" ? "🏢 Company" : "🚜 Farm"} · {role.permissionCount} perms
                        </div>
                      </div>

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          cursor: isCompulsory || !canManage ? "not-allowed" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="role-card__toggle-input"
                          checked={isActive}
                          disabled={isCompulsory || !canManage}
                          onChange={() => handleToggleRoleInPool(role)}
                        />
                      </label>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Visual Drag & Drop Hierarchy Canvas */}
          <div className="roles-studio__canvas">
            <div className="canvas-header">
              <div>
                <h3 className="canvas-header__title">
                  Organizational Authority Hierarchy
                </h3>
                <p className="canvas-header__hint">
                  Drag items vertically to arrange authority. <strong>Top = Highest Authority</strong>.
                  Click <em>Same Rank</em> to make lateral peers share identical rank.
                </p>
              </div>

              {isDirty && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Button
                    variant="ghost"
                    onClick={handleReset}
                    disabled={isSaving}
                    style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
                  >
                    <RotateCcw size={13} style={{ marginRight: "0.25rem" }} />
                    Discard
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveHierarchy}
                    disabled={isSaving}
                    style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                  >
                    <Save size={13} style={{ marginRight: "0.25rem" }} />
                    {isSaving ? "Saving…" : "Save Hierarchy"}
                  </Button>
                </div>
              )}
            </div>

            {hierarchyItems.length === 0 ? (
              <EmptyState
                title="No active roles selected"
                description="Check one or more roles from the left panel to build your company's hierarchy."
              />
            ) : (
              <Reorder.Group
                axis="y"
                values={hierarchyItems}
                onReorder={handleReorder}
                className="hierarchy-list"
              >
                {hierarchyItems.map((item, index) => {
                  const isCompulsory = item.role.isCompulsory;
                  const isPeer = item.sameAsPrevious;
                  const calculatedRank = computedRanks.get(item.id) ?? item.role.rank;
                  const prevItem = index > 0 ? hierarchyItems[index - 1] : null;

                  return (
                    <Reorder.Item
                      key={item.id}
                      value={item}
                      dragListener={!isCompulsory && canManage}
                      className={[
                        "hierarchy-card",
                        isCompulsory ? "hierarchy-card--compulsory" : "",
                        isPeer ? "hierarchy-card--peer" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {/* Drag Handle or Locked Apex Icon */}
                      <div className="hierarchy-card__drag-handle">
                        {isCompulsory ? (
                          <span title="Company Admin is pinned at Apex">
                            <Lock size={16} color="var(--color-primary, #0284c7)" />
                          </span>
                        ) : (
                          <span title="Drag to reorder position">
                            <GripVertical size={18} />
                          </span>
                        )}
                      </div>

                      {/* Main role content & tier pill */}
                      <div className="hierarchy-card__main">
                        <div
                          className={[
                            "hierarchy-tier-badge",
                            index === 0 ? "hierarchy-tier-badge--apex" : "",
                            isPeer ? "hierarchy-tier-badge--peer" : "",
                          ].filter(Boolean).join(" ")}
                          title={`Hierarchy Position #${index + 1}`}
                        >
                          {index === 0 ? "👑" : isPeer ? "🔗" : `#${index + 1}`}
                        </div>

                        <div className="hierarchy-card__details">
                          <h4 className="hierarchy-card__name">
                            {item.role.name}
                            <span className="hierarchy-card__scope">
                              {item.role.scopeLevel === "COMPANY" ? "🏢 Company" : "🚜 Farm"}
                            </span>
                          </h4>

                          {isPeer && prevItem && (
                            <div className="hierarchy-card__peer-indicator">
                              <Link2 size={12} />
                              Peer level (Shares rank with {prevItem.role.name})
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Live Rank Badge and Actions */}
                      <div className="hierarchy-card__right">
                        {/* Smoothed Rank Preview Pill */}
                        <div
                          className="hierarchy-rank-pill"
                          title={`Auto-calculated rank: ${calculatedRank} (Default: ${item.role.defaultRank})`}
                        >
                          <Sparkles size={12} />
                          Rank <strong>{calculatedRank}</strong>
                        </div>

                        {/* Control Actions */}
                        {canManage && !isCompulsory && (
                          <div className="hierarchy-actions">
                            {/* Toggle Peer / Same Rank button (only available for index > 0) */}
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => handleTogglePeerRank(index)}
                                className={[
                                  "hierarchy-peer-toggle-btn",
                                  isPeer ? "hierarchy-peer-toggle-btn--active" : "",
                                ].filter(Boolean).join(" ")}
                                title={
                                  isPeer
                                    ? "Click to separate into its own distinct rank level"
                                    : "Click to link and share the same rank with the role above"
                                }
                              >
                                {isPeer ? <Unlink size={12} /> : <Link2 size={12} />}
                                <span>{isPeer ? "Unlink" : "Same Rank"}</span>
                              </button>
                            )}

                            {/* Accessible Up/Down Buttons */}
                            <button
                              type="button"
                              className="hierarchy-micro-btn"
                              onClick={() => handleMove(index, "up")}
                              disabled={index <= 1}
                              title="Move Up"
                            >
                              <ChevronUp size={15} />
                            </button>
                            <button
                              type="button"
                              className="hierarchy-micro-btn"
                              onClick={() => handleMove(index, "down")}
                              disabled={index >= hierarchyItems.length - 1}
                              title="Move Down"
                            >
                              <ChevronDown size={15} />
                            </button>

                            {/* Remove from canvas button */}
                            <button
                              type="button"
                              className="hierarchy-micro-btn"
                              onClick={() => handleRemoveRole(item.id)}
                              style={{ color: "#dc2626" }}
                              title="Remove role from company hierarchy"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            )}
          </div>
        </div>

        {/* Floating Save Bar when dirty */}
        {isDirty && (
          <div className="hierarchy-save-bar">
            <div className="hierarchy-save-bar__info">
              <span className="hierarchy-save-bar__badge">Unsaved Changes</span>
              <span className="hierarchy-save-bar__text">
                Hierarchy modified with {hierarchyItems.length} active roles. Smoothed ranks are calculated and ready to save.
              </span>
            </div>

            <div className="hierarchy-save-bar__actions">
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={isSaving}
                style={{ color: "#cbd5e1", borderColor: "rgba(255,255,255,0.2)" }}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveHierarchy}
                disabled={isSaving}
              >
                <Save size={14} style={{ marginRight: "0.35rem" }} />
                {isSaving ? "Saving Changes…" : `Save Hierarchy (${hierarchyItems.length} roles)`}
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
