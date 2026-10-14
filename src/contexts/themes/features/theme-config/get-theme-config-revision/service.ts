import { parseThemeConfigDocument, type ThemeConfigRevisionStatus } from "../../../contracts/v8/config-document";
import { findThemeConfigRevisionById } from "./store";
import type { GetThemeConfigRevisionInput, GetThemeConfigRevisionResult } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getThemeConfigRevision(input: GetThemeConfigRevisionInput): Promise<GetThemeConfigRevisionResult> {
  if (!UUID_PATTERN.test(input.revisionId)) return { success: true, data: null };

  const found = await findThemeConfigRevisionById(input.revisionId);
  if (!found.success) return found;
  const row = found.data;
  if (!row) return { success: true, data: null };

  // Documento corrompido na tabela não vira config renderizável — tratado como inexistente.
  const config = parseThemeConfigDocument(row.config);
  if (!config) return { success: true, data: null };

  return {
    success: true,
    data: {
      id: row.id,
      status: row.status as ThemeConfigRevisionStatus,
      config,
      basedOnRevisionId: row.basedOnRevisionId,
      note: row.note,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      publishedBy: row.publishedBy,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    },
  };
}
