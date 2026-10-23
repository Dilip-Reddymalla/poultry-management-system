import { useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Columns,
  Edit2,
  GripVertical,
  Layers,
  LayoutGrid,
  Link2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react";
import { ApiError } from "../../api/client.js";
import {
  deleteCompanyCustomRole,
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
import { CompanyCustomRoleDialog } from "./CompanyCustomRoleDialog.js";
import type { HierarchyItem } from "./hierarchy-utils.js";
import {
  calculateSmoothedRanks,
  initializeHierarchy,
} from "./hierarchy-utils.js";
import { RolePermissionsModal } from "./RolePermissionsModal.js";
import "./RolesConfig.css";

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
  const [originFilter, setOriginFilter] = useState<"ALL" | "STANDARD" | "CUSTOM">("ALL");

  // View Mode: "canvas" (hierarchy full-width), "catalog" (catalog pool full-width), or "split" (dual pane)
  const [viewMode, setViewMode] = useState<"canvas" | "catalog" | "split">("canvas");

  // Modals state
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<CompanyRoleConfigItem | null>(null);
  const [customRoleDialogOpen, setCustomRoleDialogOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<CompanyRoleConfigItem | null>(null);

  const data = configResource.data;

  // Unified list of all company-applicable roles (system + company custom)
  const allRoles = useMemo(() => {
    const system = data?.systemRoles ?? [];
    const custom = data?.customRoles ?? [];
    return [...system, ...custom];
  }, [data]);

  const standardRolesCount = data?.systemRoles?.length ?? 0;
  const customRolesCount = data?.customRoles?.length ?? 0;

  // Initialize or re-sync local hierarchy when remote data is loaded
  useEffect(() => {
    if (allRoles.length > 0) {
      const initialized = initializeHierarchy(allRoles);
      setHierarchyItems(initialized);
      setInitialSnapshot(
        JSON.stringify(
          initialized.map((item) => ({ id: item.id, sameAsPrevious: item.sameAsPrevious })),
        ),
      );
    }
  }, [allRoles]);

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
    const initialized = initializeHierarchy(allRoles);
    setHierarchyItems(initialized);
  }

  // Select all or remove all optional roles
  function handleBulkSelect(selectAll: boolean): void {
    if (!canManage) return;

    if (selectAll) {
      const currentlyActive = new Set(hierarchyItems.map((item) => item.id));
      const newlyAdded: HierarchyItem[] = [];

      allRoles.forEach((role) => {
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

  // Delete a custom role
  async function handleDeleteCustomRole(role: CompanyRoleConfigItem): Promise<void> {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to delete custom role "${role.name}"?`)) {
      return;
    }

    try {
      await deleteCompanyCustomRole(companyId, role.id);
      notify("success", `Custom role "${role.name}" deleted.`);
      configResource.reload();
    } catch (caught) {
      notify("error", caught instanceof ApiError ? caught.message : "Failed to delete custom role.");
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
      const inactivePayload = allRoles
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

  const filteredPoolRoles = allRoles.filter((role) => {
    const matchesSearch =
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(search.toLowerCase()));

    const matchesScope = scopeFilter === "ALL" || role.scopeLevel === scopeFilter;

    const matchesOrigin =
      originFilter === "ALL" ||
      (originFilter === "STANDARD" && !role.isCustom) ||
      (originFilter === "CUSTOM" && role.isCustom);

    return matchesSearch && matchesScope && matchesOrigin;
  });

  const enabledCount = hierarchyItems.length;
  const totalCount = allRoles.length;

  // Render pool catalog element
  const renderCatalogPool = () => (
    <div className="roles-studio__pool">
      <div className="pool-header">
        <h3 className="pool-header__title">
          <LayoutGrid size={16} /> Roles Catalog
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-muted, #64748b)" }}>
            {filteredPoolRoles.length} roles
          </span>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setRoleToEdit(null);
                setCustomRoleDialogOpen(true);
              }}
              style={{
                background: "rgba(2, 132, 199, 0.08)",
                border: "1px solid rgba(2, 132, 199, 0.25)",
                color: "var(--color-primary, #0284c7)",
                borderRadius: "0.3rem",
                padding: "0.2rem 0.45rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Plus size={12} /> New Custom
            </button>
          )}
        </div>
      </div>

      <div className="pool-search">
        <input
          type="text"
          placeholder="Search roles by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="roles-search-input"
          style={{ width: "100%", boxSizing: "border-box" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
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

          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            className="roles-scope-select"
            style={{ width: "100%" }}
          >
            <option value="ALL">All Origins</option>
            <option value="STANDARD">🛡️ Standard</option>
            <option value="CUSTOM">✨ Custom</option>
          </select>
        </div>
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
                    <span>{role.name}</span>
                    {isCompulsory && (
                      <span title="Company Admin is pinned at Apex">
                        <Lock size={12} color="#7c3aed" />
                      </span>
                    )}
                    {role.isCustom && (
                      <span className="role-tag-badge role-tag-badge--custom">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="pool-item__sub">
                    <span>{role.scopeLevel === "COMPANY" ? "🏢 Company" : "🚜 Farm"}</span>
                    <span>·</span>
                    {/* Option to show permissions */}
                    <button
                      type="button"
                      className="role-perms-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoleForPerms(role);
                      }}
                      title="Inspect permissions"
                    >
                      <Shield size={11} /> {role.permissionCount} perms
                    </button>
                  </div>
                </div>

                <div className="pool-item__actions">
                  {/* Edit & delete for custom roles */}
                  {role.isCustom && canManage && (
                    <>
                      <button
                        type="button"
                        className="hierarchy-micro-btn"
                        title="Edit custom role"
                        onClick={() => {
                          setRoleToEdit(role);
                          setCustomRoleDialogOpen(true);
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="hierarchy-micro-btn"
                        title="Delete custom role"
                        style={{ color: "#dc2626" }}
                        onClick={() => handleDeleteCustomRole(role)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      cursor: isCompulsory || !canManage ? "not-allowed" : "pointer",
                      padding: "0.2rem",
                    }}
                    title={isActive ? "Active in hierarchy" : "Inactive"}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Render canvas element
  const renderHierarchyCanvas = () => (
    <div className="roles-studio__canvas">
      <div className="canvas-header">
        <div>
          <h3 className="canvas-header__title">
            <Layers size={16} /> Authority Hierarchy
          </h3>
          <p className="canvas-header__hint">
            Top = Highest Authority. Link roles with <em>Same Rank</em> to share identical level.
          </p>
        </div>

        {isDirty && (
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={isSaving}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
            >
              <RotateCcw size={13} style={{ marginRight: "0.25rem" }} />
              Discard
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveHierarchy}
              disabled={isSaving}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
            >
              <Save size={13} style={{ marginRight: "0.25rem" }} />
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {hierarchyItems.length === 0 ? (
        <EmptyState
          title="No active roles selected"
          description="Select roles from the catalog to build your company's hierarchy."
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
            const isCustom = item.role.isCustom;
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
                  isCustom ? "hierarchy-card--custom" : "",
                  isPeer ? "hierarchy-card--peer" : "",
                ].filter(Boolean).join(" ")}
              >
                {/* Main: Drag Handle or Apex Icon + Details */}
                <div className="hierarchy-card__main">
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
                      <span>{item.role.name}</span>
                      <span className="role-tag-badge role-tag-badge--scope">
                        {item.role.scopeLevel === "COMPANY" ? "🏢 Company" : "🚜 Farm"}
                      </span>
                      {isCustom && (
                        <span className="role-tag-badge role-tag-badge--custom">
                          ✨ Custom
                        </span>
                      )}
                    </h4>

                    {isPeer && prevItem && (
                      <div className="hierarchy-card__peer-indicator">
                        <Link2 size={11} />
                        Peer with {prevItem.role.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Permissions Button, Smoothed Rank Pill & Controls */}
                <div className="hierarchy-card__right">
                  <div className="hierarchy-card__meta-group">
                    {/* Option to show permissions */}
                    <button
                      type="button"
                      className="role-perms-btn"
                      onClick={() => setSelectedRoleForPerms(item.role)}
                      title="Inspect permissions"
                    >
                      <Shield size={11} />
                      {item.role.permissionCount} perms
                    </button>

                    {/* Smoothed Rank Preview Pill */}
                    <div
                      className="hierarchy-rank-pill"
                      title={`Auto-calculated rank: ${calculatedRank}`}
                    >
                      <Sparkles size={11} />
                      Rank <strong>{calculatedRank}</strong>
                    </div>
                  </div>

                  {/* Control Actions */}
                  {canManage && !isCompulsory && (
                    <div className="hierarchy-actions">
                      {/* Toggle Peer / Same Rank button (index > 0) */}
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
                              ? "Separate into its own distinct rank level"
                              : "Share the same rank with the role above"
                          }
                        >
                          {isPeer ? <Unlink size={11} /> : <Link2 size={11} />}
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
                        aria-label="Move Up"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="hierarchy-micro-btn"
                        onClick={() => handleMove(index, "down")}
                        disabled={index >= hierarchyItems.length - 1}
                        title="Move Down"
                        aria-label="Move Down"
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
                        aria-label="Remove Role"
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
  );

  return (
    <div className="roles-config-container">
      <Panel
        title="Roles & Hierarchy Studio"
        eyebrow="Enterprise Access Control"
        actions={
          canManage ? (
            <div className="roles-header-actions">
              <Button
                variant="primary"
                onClick={() => {
                  setRoleToEdit(null);
                  setCustomRoleDialogOpen(true);
                }}
              >
                <Plus size={14} style={{ marginRight: "0.25rem" }} />
                Add Custom Role
              </Button>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => handleBulkSelect(true)}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                disabled={isSaving}
                onClick={() => handleBulkSelect(false)}
              >
                Reset to Apex
              </Button>
            </div>
          ) : null
        }
      >
        {/* Scannable Toolbar Stats */}
        <div className="roles-toolbar">
          <div className="roles-toolbar__stats">
            <div>
              <span className="roles-toolbar__stat-label">Hierarchy</span>
              <span className="roles-toolbar__stat-val">
                {enabledCount} <span className="roles-toolbar__stat-sub">/ {totalCount} active</span>
              </span>
            </div>
            <div className="roles-toolbar__divider" />
            <div>
              <span className="roles-toolbar__stat-label">Composition</span>
              <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.2rem" }}>
                <span className="role-tag-badge role-tag-badge--standard">
                  🛡️ {standardRolesCount} Standard
                </span>
                <span className="role-tag-badge role-tag-badge--custom">
                  ✨ {customRolesCount} Custom
                </span>
              </div>
            </div>
            <div className="roles-toolbar__divider" />
            <div>
              <span className="roles-toolbar__stat-label">Apex Authority</span>
              <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ink, #0f172a)", display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.15rem" }}>
                Company Admin <span className="role-tag-badge role-tag-badge--accent">🔒 Apex</span>
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher: Canvas | Catalog | Split View */}
        <div className="roles-view-nav">
          <button
            type="button"
            className={`roles-view-tab ${viewMode === "canvas" ? "roles-view-tab--active" : ""}`}
            onClick={() => setViewMode("canvas")}
          >
            <Layers size={14} />
            Hierarchy Canvas ({hierarchyItems.length})
          </button>
          <button
            type="button"
            className={`roles-view-tab ${viewMode === "catalog" ? "roles-view-tab--active" : ""}`}
            onClick={() => setViewMode("catalog")}
          >
            <LayoutGrid size={14} />
            Roles Catalog ({filteredPoolRoles.length})
          </button>
          <button
            type="button"
            className={`roles-view-tab roles-view-tab--split-only ${viewMode === "split" ? "roles-view-tab--active" : ""}`}
            onClick={() => setViewMode("split")}
          >
            <Columns size={14} />
            Split Studio
          </button>
        </div>

        {/* Studio View */}
        {viewMode === "split" ? (
          <div className="roles-studio roles-studio--split">
            {renderCatalogPool()}
            {renderHierarchyCanvas()}
          </div>
        ) : viewMode === "canvas" ? (
          <div className="roles-studio roles-studio--single">
            {renderHierarchyCanvas()}
          </div>
        ) : (
          <div className="roles-studio roles-studio--single">
            {renderCatalogPool()}
          </div>
        )}

        {/* Floating Save Bar when dirty */}
        {isDirty && (
          <div className="hierarchy-save-bar">
            <div className="hierarchy-save-bar__info">
              <span className="hierarchy-save-bar__badge">Unsaved</span>
              <span className="hierarchy-save-bar__text">
                {hierarchyItems.length} active roles positioned. Smoothed ranks calculated.
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
                {isSaving ? "Saving…" : "Save Hierarchy"}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Permissions Inspection Modal */}
      {selectedRoleForPerms && (
        <RolePermissionsModal
          role={selectedRoleForPerms}
          onClose={() => setSelectedRoleForPerms(null)}
        />
      )}

      {/* Custom Role Create / Edit Dialog */}
      {customRoleDialogOpen && (
        <CompanyCustomRoleDialog
          companyId={companyId}
          role={roleToEdit}
          onClose={() => {
            setCustomRoleDialogOpen(false);
            setRoleToEdit(null);
          }}
          onSaved={() => {
            setCustomRoleDialogOpen(false);
            setRoleToEdit(null);
            notify("success", roleToEdit ? "Custom role updated." : "Custom role created.");
            configResource.reload();
          }}
        />
      )}
    </div>
  );
}
