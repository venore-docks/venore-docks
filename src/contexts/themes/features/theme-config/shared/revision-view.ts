import { parseThemeConfigDocument, type ThemeConfigRevisionStatus, type ThemeConfigRevisionView } from "../../../contracts/v8/config-document";
import type { themeConfigRevisions } from "../../../database/schema";

export type ThemeConfigRevisionRow = typeof themeConfigRevisions.$inferSelect;

export const THEME_CONFIG_REVISION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Linha → visão do admin (datas em ISO). Documento corrompido na tabela não vira config
// utilizável: null (quem chama trata como inexistente) — mesmo critério de get-theme-config-revision.
export function toThemeConfigRevisionView(row: ThemeConfigRevisionRow): ThemeConfigRevisionView | null {
  const config = parseThemeConfigDocument(row.config);
  if (!config) return null;
  return {
    id: row.id,
    status: row.status as ThemeConfigRevisionStatus,
    config,
    basedOnRevisionId: row.basedOnRevisionId,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}
