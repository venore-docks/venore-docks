import type { ComponentType } from "react";
import type { PageStateProps, ThemeServerStateKey } from "@/contexts/themes/contracts/v8";
import { KitLoadingState, KitPageState } from "./page-state";

// Estados do kit (spec §2.7 / §7.9). Dono: W4.
export const KIT_STATES: Record<ThemeServerStateKey, ComponentType<PageStateProps>> = {
  loading: KitLoadingState,
  empty: KitPageState,
  forbidden: KitPageState,
  maintenance: KitPageState,
  notFound: KitPageState,
};
export { KitPageState, KitLoadingState };
