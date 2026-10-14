import { authorizeActor } from "@/contexts/rbac";
import { exportThemeConfig } from "./service";
import type { ExportThemeConfigInput, ExportThemeConfigResult } from "./types";

export async function exportThemeConfigHandler(input: ExportThemeConfigInput = {}): Promise<ExportThemeConfigResult> {
  const themeVersion = typeof input.themeVersion === "string" ? input.themeVersion.slice(0, 64) : undefined;
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return exportThemeConfig({ themeVersion, actorId: authz.actorId });
}
