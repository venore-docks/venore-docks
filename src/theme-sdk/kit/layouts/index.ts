import type { ThemeLayoutComponent, ThemeLayoutPreset } from "@/contexts/themes/contracts/v8";
import { RailLayout } from "./rail-layout";
import { TopbarLayout } from "./topbar-layout";

// Presets de layout do kit (spec §6 — ThemeRenderer usa KIT_LAYOUTS[preset]). Dono: W3.
export const KIT_LAYOUTS: Record<ThemeLayoutPreset, ThemeLayoutComponent> = {
  topbar: TopbarLayout,
  rail: RailLayout,
};
export { TopbarLayout, RailLayout };
export { ContentFrame, ContentSlot } from "./content-frame";
export { Shell } from "./kit-shell";
