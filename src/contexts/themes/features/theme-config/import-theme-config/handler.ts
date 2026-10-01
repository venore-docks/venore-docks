import { authorizeActor } from "@/contexts/rbac";
import { themeConfigExportEnvelopeSchema, type ThemeConfigExportEnvelope } from "../../../contracts/v8/config-document";
import { importThemeConfig } from "./service";
import type { ImportThemeConfigInput, ImportThemeConfigOperationResult } from "./types";

export async function importThemeConfigHandler(input: ImportThemeConfigInput): Promise<ImportThemeConfigOperationResult> {
  const parsed = themeConfigExportEnvelopeSchema.safeParse(input?.envelope);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: {
        code: "themes.config.import_invalid",
        message: `Arquivo de aparência inválido${issue ? ` (${issue.path.join(".") || "raiz"}: ${issue.message})` : ""}.`,
      },
    };
  }
  const warnings = Array.isArray(input.warnings) ? input.warnings.filter((warning) => typeof warning === "string").slice(0, 200) : [];

  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return importThemeConfig({ envelope: parsed.data as ThemeConfigExportEnvelope, warnings, actorId: authz.actorId });
}
