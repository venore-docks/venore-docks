import type { PageWidth } from "@/contexts/themes/contracts/v8/enums";

// Layout por página, guardado em cms.entries.data.layout (spec v8 §4.5 — sem migration). Dono: W5.
export type PageLayout = {
  width?: PageWidth;
  rail?: "auto" | "hidden";
  contextualBar?: "auto" | "side" | "top" | "none";
  template?: string; // valor de templateVariants do tema
};
export const ENTRY_LAYOUT_DATA_KEY = "layout";
