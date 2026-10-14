import type { ThemeLayoutComponent, ThemeLayoutPreset } from "@/contexts/themes/contracts/v8";
import { RailLayout } from "./rail-layout";
import { TopbarLayout } from "./topbar-layout";

// Presets de layout do kit (spec §6 — ThemeRenderer usa KIT_LAYOUTS[preset]). Dono: W3.
export const KIT_LAYOUTS: Record<ThemeLayoutPreset, ThemeLayoutComponent> = {
  topbar: TopbarLayout,
  rail: RailLayout,
};
export { TopbarLayout, RailLayout };
export { ContentFrame, ContentSlot, type ContextualMobileMode } from "./content-frame";
export { SkipLink, KIT_MAIN_CONTENT_ID } from "./skip-link";
export type { KitLayoutProps } from "./kit-layout-props";
export { Shell } from "./kit-shell";
