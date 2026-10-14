import { authorizeActor } from "@/contexts/rbac";
import { THEME_CONFIG_REVISION_ID_PATTERN } from "../shared/revision-view";
import { rollbackThemeConfig } from "./service";
import type { RollbackThemeConfigInput, RollbackThemeConfigResult } from "./types";

export async function rollbackThemeConfigHandler(input: RollbackThemeConfigInput): Promise<RollbackThemeConfigResult> {
  if (typeof input?.revisionId !== "string" || !THEME_CONFIG_REVISION_ID_PATTERN.test(input.revisionId)) {
    return { success: false, error: { code: "themes.config.invalid_revision_id", message: "revisionId inválido." } };
  }
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return rollbackThemeConfig({ revisionId: input.revisionId, actorId: authz.actorId });
}
