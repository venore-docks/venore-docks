import type { RenderOverride } from "@/contexts/themes/contracts/v8";

// Override de render (rascunho/galeria/safe-mode) lido do cookie assinado `venore-theme-preview`
// (spec §7.2). Dono: W6 — na Fase F nunca há override.
export async function readThemeOverride(context: { pathname: string | null; area: "public" | "admin" }): Promise<RenderOverride | null> {
  void context;
  return null;
}
