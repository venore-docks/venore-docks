import type { ComponentType } from "react";
import type { PageStateProps, ThemeServerStateKey } from "@/contexts/themes/contracts/v8";
import { KitEmptyPageState, KitEmptyState } from "./empty-state";
import { KitLoadingState, KitMaintenanceState, KitPageState } from "./page-state";

// Estados do kit (spec §2.7 / §7.9). "error" é client-only (error-state.tsx).
export const KIT_STATES: Record<ThemeServerStateKey, ComponentType<PageStateProps>> = {
  loading: KitLoadingState,
  empty: KitEmptyPageState,
  forbidden: KitPageState,
  maintenance: KitMaintenanceState,
  notFound: KitPageState,
};
export { KitPageState, KitLoadingState, KitMaintenanceState, KitEmptyPageState, KitEmptyState };
