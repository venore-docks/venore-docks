import { publishThemeDraft } from "../publish-theme-draft/service";
import { saveThemeDraft } from "../save-theme-draft/service";
import { toThemeConfigRevisionView } from "../shared/revision-view";
import { findRevisionRow } from "./store";
import type { RollbackThemeConfigCommand, RollbackThemeConfigResult } from "./types";

// Rollback (spec §4.3): copia a config de uma revisão arquivada para o rascunho e roda os passos
// de publicação — o resultado é uma revisão NOVA publicada (a antiga continua no histórico),
// auditada como themes.config.rollback. O rascunho em andamento, se houver, é substituído.
export async function rollbackThemeConfig(command: RollbackThemeConfigCommand): Promise<RollbackThemeConfigResult> {
  const found = await findRevisionRow(command.revisionId);
  if (!found.success) return found;
  const target = found.data ? toThemeConfigRevisionView(found.data) : null;
  if (!target || target.status === "draft") {
    return { success: false, error: { code: "themes.config.revision_not_found", message: "Revisão não encontrada no histórico." } };
  }
  if (target.status === "published") {
    return { success: false, error: { code: "themes.config.rollback_current", message: "Esta revisão já é a publicada." } };
  }

  const draft = await saveThemeDraft({
    config: target.config,
    basedOnRevisionId: target.id,
    note: `Restauração da publicação de ${target.publishedAt ?? target.createdAt}`,
    actorId: command.actorId,
  });
  if (!draft.success) return draft;

  return publishThemeDraft({
    actorId: command.actorId,
    audit: { action: "themes.config.rollback", detail: { rolledBackTo: target.id } },
  });
}
