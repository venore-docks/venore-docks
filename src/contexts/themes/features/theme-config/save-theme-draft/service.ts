import { beginOperation, endOperation } from "@/observability";
import { toThemeConfigRevisionView } from "../shared/revision-view";
import { normalizeSectionOverrides } from "../shared/section-rules";
import { upsertDraftRevision } from "./store";
import type { SaveThemeDraftCommand, SaveThemeDraftResult } from "./types";

// Grava o rascunho compartilhado (spec §7.2). O documento já chegou validado pelo zod (handler) e
// contra o registro de temas (platform/theme-engine/validate-theme-config.ts); aqui fica a regra
// do próprio documento: prefixos de seção normalizados e nunca reservados. Também usado por
// import e rollback (mesmo context), que só gravam rascunho.
export async function saveThemeDraft(command: SaveThemeDraftCommand): Promise<SaveThemeDraftResult> {
  const handle = beginOperation({ useCase: "themes.theme-config.save-draft", actor: { id: command.actorId, type: "user" }, kind: "write" });

  const sections = normalizeSectionOverrides(command.config.sections);
  if (!sections.success) {
    endOperation(handle, { success: false, error: sections.error });
    return sections;
  }

  const saved = await upsertDraftRevision({
    config: { ...command.config, sections: sections.data },
    basedOnRevisionId: command.basedOnRevisionId,
    note: command.note,
    actorId: command.actorId,
  });
  if (!saved.success) {
    endOperation(handle, { success: false, error: saved.error });
    return saved;
  }

  const view = toThemeConfigRevisionView(saved.data);
  if (!view) {
    const error = { code: "themes.config.invalid_document", message: "O rascunho gravado não é um documento de tema válido." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  endOperation(handle, { success: true, summary: `Rascunho de aparência salvo (tema ${view.config.themeKey}).`, detail: { revisionId: view.id } });
  return { success: true, data: view };
}
