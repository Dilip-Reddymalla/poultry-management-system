import { useEffect, useRef } from "react";
import type { Farm } from "../api/types.js";
import { useAuth } from "../auth/use-auth.js";

export const LAST_SELECTED_FARM_STORAGE_KEY = "pms_last_selected_farm_id";

/**
 * Reads the most recently selected farm ID from localStorage
 */
export function getLastSelectedFarmId(): string {
  try {
    return localStorage.getItem(LAST_SELECTED_FARM_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Saves the selected farm ID to localStorage
 */
export function setLastSelectedFarmId(farmId: string): void {
  try {
    if (farmId) {
      localStorage.setItem(LAST_SELECTED_FARM_STORAGE_KEY, farmId);
    } else {
      localStorage.removeItem(LAST_SELECTED_FARM_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or disabled localStorage exceptions
  }
}

/**
 * Hook to automatically synchronize, select, and persist the active farm filter.
 * - For farm-scoped users (FARM level): automatically defaults to their assigned farm.
 * - For company admins / multi-farm users (COMPANY / GLOBAL level):
 *   automatically selects the most recently chosen farm stored in localStorage (or auto-selects if single farm).
 *
 * @param farmId Current farmId in URL query or local state
 * @param onSelectFarm Callback to apply the farmId (e.g. update URL searchParams)
 * @param availableFarms List of farms available to the user
 */
export function useAutoSelectFarm(
  farmId: string,
  onSelectFarm: (selectedId: string) => void,
  availableFarms?: Farm[] | null | undefined,
) {
  const { user } = useAuth();
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    // 1. If user is farm-scoped, strictly bind to their assigned farm
    if (user?.scope?.level === "FARM" && user.scope.farmId) {
      if (farmId !== user.scope.farmId) {
        onSelectFarm(user.scope.farmId);
      }
      return;
    }

    // 2. For multi-farm users (Company Admin, System Admin), if no farm filter is in the URL yet:
    if (!farmId && !autoSelectedRef.current && availableFarms && availableFarms.length > 0) {
      const stored = getLastSelectedFarmId();

      // Check if the stored farm still exists in the user's available farms
      if (stored && availableFarms.some((f) => f.id === stored)) {
        autoSelectedRef.current = true;
        onSelectFarm(stored);
        return;
      }

      // If user only has access to a single farm, auto-select it
      if (availableFarms.length === 1 && availableFarms[0]?.id) {
        autoSelectedRef.current = true;
        setLastSelectedFarmId(availableFarms[0].id);
        onSelectFarm(availableFarms[0].id);
        return;
      }
    }
  }, [user, farmId, availableFarms, onSelectFarm]);

  // Handler for dropdown/picker change: saves to localStorage and updates state/URL
  const handleFarmChange = (newFarmId: string) => {
    setLastSelectedFarmId(newFarmId);
    onSelectFarm(newFarmId);
  };

  return { handleFarmChange };
}
