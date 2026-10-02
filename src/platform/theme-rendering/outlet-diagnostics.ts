import { THEME_OUTLET_NAMES } from "@/contexts/themes/contracts/v8";
import { PLUGIN_CONTRIBUTIONS } from "@/plugins/contributions";
import { resolveActiveTheme } from "./resolve-active-theme";
import { resolveThemeDefinition } from "./resolve-theme-definition";
import { diagnoseOutlets, type OutletDiagnostic } from "./resolve-theme-outlets";

export type ActiveThemeOutletDiagnostics = { themeKey: string; themeName: string; items: OutletDiagnostic[] };

// Diagnóstico de /admin/plugins (spec v8 §7.4): outlets declarados por plugins — em
// contributions.ts ou no `outlets` do manifesto — que o tema ATIVO (persistido) não renderiza.
// `manifests` vem do relatório de registro que a página já carregou (sem leitura extra).
export async function getActiveThemeOutletDiagnostics(
  manifests: Readonly<Record<string, { outlets?: readonly { key: string; outlet: string }[] }>>,
): Promise<ActiveThemeOutletDiagnostics> {
  const entry = await resolveActiveTheme();
  const { theme } = resolveThemeDefinition(entry.manifest.key);
  return {
    themeKey: theme.key,
    themeName: theme.manifest.name,
    items: diagnoseOutlets(PLUGIN_CONTRIBUTIONS, manifests, theme.outletsRendered, THEME_OUTLET_NAMES),
  };
}
