import { recordAuditEvent } from "@/observability";
import { saveThemeDraft } from "../save-theme-draft/service";
import type { ImportThemeConfigCommand, ImportThemeConfigOperationResult } from "./types";

// Importa um envelope exportado (spec §7.10) SÓ como rascunho: nada é publicado, nada no settings
// muda. Quem quiser aplicar revisa no Personalizar e publica.
export async function importThemeConfig(command: ImportThemeConfigCommand): Promise<ImportThemeConfigOperationResult> {
  const draft = await saveThemeDraft({
    config: command.envelope.config,
    basedOnRevisionId: undefined,
    note: `Importado de ${command.envelope.theme.key}@${command.envelope.theme.version} (${command.envelope.exportedAt})`.slice(0, 500),
    actorId: command.actorId,
  });
  if (!draft.success) return draft;

  await recordAuditEvent({
    action: "themes.config.import",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary: `Configuração de aparência importada como rascunho (tema ${draft.data.config.themeKey}).`,
    detail: { revisionId: draft.data.id, themeKey: draft.data.config.themeKey, warnings: command.warnings.slice(0, 50) },
  });

  return { success: true, data: { draft: draft.data, warnings: command.warnings } };
}
