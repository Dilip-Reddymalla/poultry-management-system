import type { CompanyRoleConfigItem } from "../../api/types.js";

export interface HierarchyItem {
  id: string;
  role: CompanyRoleConfigItem;
  sameAsPrevious: boolean;
}

/**
 * Initializes the hierarchy list from fetched company roles.
 * - Filters to enabled roles.
 * - Sorts by effective rank descending (Company Admin pinned first).
 * - Detects if adjacent roles previously shared the same rank.
 */
export function initializeHierarchy(roles: CompanyRoleConfigItem[]): HierarchyItem[] {
  const enabledRoles = roles
    .filter((r) => r.isEnabled || r.isCompulsory)
    .sort((a, b) => {
      // Company Admin is always first
      if (a.isCompulsory) return -1;
      if (b.isCompulsory) return 1;
      return b.rank - a.rank;
    });

  return enabledRoles.map((role, index) => {
    let sameAsPrevious = false;
    if (index > 0 && !role.isCompulsory) {
      const prevRole = enabledRoles[index - 1];
      if (prevRole && prevRole.rank === role.rank) {
        sameAsPrevious = true;
      }
    }

    return {
      id: role.id,
      role,
      sameAsPrevious,
    };
  });
}

/**
 * Calculates smoothed ranks for all items in the hierarchy.
 * - Roles with sameAsPrevious === true share the exact same rank as the role above them.
 * - Distinct tiers are distributed smoothly between topRank (90) and baseRank (20).
 * - Step sizes are smoothed to clean increments (e.g. multiples of 5 or 10 when possible).
 */
export function calculateSmoothedRanks(
  items: HierarchyItem[],
  topRank: number = 90,
  baseRank: number = 20,
): Map<string, number> {
  const rankMap = new Map<string, number>();
  if (items.length === 0) return rankMap;

  // 1. Group items into distinct tiers (clusters of peer roles)
  const tiers: string[][] = [];
  let isFirst = true;
  for (const item of items) {
    if (isFirst || !item.sameAsPrevious) {
      tiers.push([item.id]);
      isFirst = false;
    } else {
      const lastTier = tiers[tiers.length - 1];
      if (lastTier) {
        lastTier.push(item.id);
      } else {
        tiers.push([item.id]);
      }
    }
  }

  const numTiers = tiers.length;

  if (numTiers === 1) {
    const firstTier = tiers[0];
    if (firstTier) {
      for (const roleId of firstTier) {
        rankMap.set(roleId, topRank);
      }
    }
    return rankMap;
  }

  // 2. Compute smooth step size
  const totalSpan = topRank - baseRank;
  const rawStep = totalSpan / (numTiers - 1);

  // Round step to a clean multiple of 5 if rawStep >= 6, otherwise round to integer
  let step = rawStep >= 6 ? Math.round(rawStep / 5) * 5 : Math.max(1, Math.round(rawStep));
  if (step < 1) step = 1;

  // 3. Assign smoothed ranks to each tier
  tiers.forEach((tierRoleIds, tierIdx) => {
    let tierRank: number;
    if (tierIdx === 0) {
      tierRank = topRank;
    } else {
      tierRank = Math.max(1, topRank - tierIdx * step);
    }

    // Assign identical smoothed rank to all peer roles in this tier
    for (const roleId of tierRoleIds) {
      rankMap.set(roleId, tierRank);
    }
  });

  return rankMap;
}
