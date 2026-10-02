import type { OperationResult } from "@/shared/types";
import { THEME_CONFIG_STORAGE_UNAVAILABLE, isUndefinedTableError } from "./storage-errors";

// Todo acesso de store à tabela de revisões passa por aqui (spec §4.2): 42P01 (migration 0054 não
// aplicada) vira erro de negócio `themes.config.storage_unavailable`, qualquer outra falha de
// banco continua sendo exceção (infra).
export async function guardThemeConfigStorage<T>(run: () => Promise<T>): Promise<OperationResult<T>> {
  try {
    return { success: true, data: await run() };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        success: false,
        error: {
          code: THEME_CONFIG_STORAGE_UNAVAILABLE,
          message: "Tabela themes.theme_config_revisions ausente (migration 0054 não aplicada).",
        },
      };
    }
    throw error;
  }
}
