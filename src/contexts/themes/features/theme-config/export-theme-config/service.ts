import { recordAuditEvent } from "@/observability";
import { CURRENT_THEME_CONTRACT_VERSION } from "../../../contracts/contract-version";
import type { ThemeConfigDocument } from "../../../contracts/v8/config-document";
import { getPublishedThemeConfig } from "../get-published-theme-config/service";
import type { ExportThemeConfigCommand, ExportThemeConfigResult } from "./types";

// Exporta a config PUBLICADA (spec §7.10) num envelope versionado. Sem store próprio: o dado é o
// mesmo do read path (settings → síntese legada), lido pelo service do mesmo context.
export async function exportThemeConfig(command: ExportThemeConfigCommand): Promise<ExportThemeConfigResult> {
  const published = await getPublishedThemeConfig();
  if (!published.success) return published;

  const { revisionId, publishedAt, source, ...document } = published.data;
  void publishedAt;
  void source;
  const config: ThemeConfigDocument = document;

  await recordAuditEvent({
    action: "themes.config.export",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary: `Configuração de aparência exportada (tema ${config.themeKey}).`,
    detail: { revisionId, themeKey: config.themeKey },
  });

  return {
    success: true,
    data: {
      format: "venore-theme-config",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      coreContract: CURRENT_THEME_CONTRACT_VERSION,
      theme: { key: config.themeKey, version: command.themeVersion ?? "0.0.0" },
      config,
    },
  };
}
