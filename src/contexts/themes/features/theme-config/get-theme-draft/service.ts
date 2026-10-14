import { toThemeConfigRevisionView } from "../shared/revision-view";
import { findDraftRevisionRow } from "./store";
import type { GetThemeDraftResult } from "./types";

// O rascunho compartilhado do site (um só — índice único parcial). Documento corrompido conta
// como "sem rascunho": o admin recomeça do publicado em vez de travar.
export async function getThemeDraft(): Promise<GetThemeDraftResult> {
  const found = await findDraftRevisionRow();
  if (!found.success) return found;
  return { success: true, data: found.data ? toThemeConfigRevisionView(found.data) : null };
}
