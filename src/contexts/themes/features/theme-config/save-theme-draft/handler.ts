import { authorizeActor } from "@/contexts/rbac";
import { themeConfigDocumentSchema, type ThemeConfigDocument } from "../../../contracts/v8/config-document";
import { THEME_CONFIG_REVISION_ID_PATTERN } from "../shared/revision-view";
import { saveThemeDraft } from "./service";
import type { SaveThemeDraftInput, SaveThemeDraftResult } from "./types";

const NOTE_MAX_LENGTH = 500;

export async function saveThemeDraftHandler(input: SaveThemeDraftInput): Promise<SaveThemeDraftResult> {
  const parsed = themeConfigDocumentSchema.safeParse(input?.config);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "themes.config.invalid_document", message: `Documento de aparência inválido: ${parsed.error.issues[0]?.message ?? "formato"}.` },
    };
  }
  const basedOn = input.basedOnRevisionId;
  if (basedOn !== undefined && basedOn !== null && !THEME_CONFIG_REVISION_ID_PATTERN.test(basedOn)) {
    return { success: false, error: { code: "themes.config.invalid_revision_id", message: "basedOnRevisionId inválido." } };
  }
  if (input.note !== undefined && input.note !== null && (typeof input.note !== "string" || input.note.length > NOTE_MAX_LENGTH)) {
    return { success: false, error: { code: "themes.config.invalid_note", message: `Nota com no máximo ${NOTE_MAX_LENGTH} caracteres.` } };
  }

  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };

  return saveThemeDraft({
    config: parsed.data as ThemeConfigDocument,
    basedOnRevisionId: basedOn,
    note: input.note,
    actorId: authz.actorId,
  });
}
