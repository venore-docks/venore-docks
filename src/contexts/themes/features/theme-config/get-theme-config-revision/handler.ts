import { authorizeActor } from "@/contexts/rbac";
import { getThemeConfigRevision } from "./service";
import type { GetThemeConfigRevisionInput, GetThemeConfigRevisionResult } from "./types";

// Rascunho/histórico são do admin (spec §4.4: settings.manage).
export async function getThemeConfigRevisionHandler(input: GetThemeConfigRevisionInput): Promise<GetThemeConfigRevisionResult> {
  if (typeof input?.revisionId !== "string" || input.revisionId.length === 0) {
    return { success: false, error: { code: "themes.config.invalid_revision_id", message: "revisionId é obrigatório." } };
  }
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return getThemeConfigRevision(input);
}
