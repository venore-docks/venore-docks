import type { UpdateEntryLayoutInput, UpdateEntryLayoutResult } from "./types";

// Regra de update-entry-layout (escopo por categoria, proposta quando publicada). Dono: W5 —
// stub da Fase F: não grava nada.
export async function updateEntryLayout(input: UpdateEntryLayoutInput): Promise<UpdateEntryLayoutResult> {
  void input;
  return {
    success: false,
    error: { code: "cms.entries.layout_unavailable", message: "Layout por página ainda não disponível." },
  };
}
