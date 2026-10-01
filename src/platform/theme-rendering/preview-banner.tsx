import type { RenderOverride } from "@/contexts/themes/contracts/v8";

// Faixa "você está vendo um rascunho/galeria/modo seguro" com publicar/descartar/sair (spec
// §7.2). Dono: W6 — sem override (sempre, na Fase F) não renderiza nada.
export function PreviewBanner({ override }: { override: RenderOverride | null }): null {
  void override;
  return null;
}
