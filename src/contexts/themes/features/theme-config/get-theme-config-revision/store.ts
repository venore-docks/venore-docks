import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { OperationResult } from "@/shared/types";
import { themeConfigRevisions } from "../../../database/schema";
import { THEME_CONFIG_STORAGE_UNAVAILABLE, isUndefinedTableError } from "../shared/storage-errors";

export type ThemeConfigRevisionRow = typeof themeConfigRevisions.$inferSelect;

export async function findThemeConfigRevisionById(id: string): Promise<OperationResult<ThemeConfigRevisionRow | null>> {
  try {
    const rows = await db.select().from(themeConfigRevisions).where(eq(themeConfigRevisions.id, id)).limit(1);
    return { success: true, data: rows[0] ?? null };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        success: false,
        error: { code: THEME_CONFIG_STORAGE_UNAVAILABLE, message: "Tabela themes.theme_config_revisions ausente (migration 0054 não aplicada)." },
      };
    }
    throw error;
  }
}
