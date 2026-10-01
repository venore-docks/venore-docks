import { Badge } from "@/components/ui/badge";
import type { AdminActor } from "@/platform/admin-shell/types";
import { listThemeStates } from "@/platform/theme-engine/list-theme-states";
import { THEME_REGISTRY } from "@/themes/registry";
import themeReport from "@/themes/theme-report.generated.json";
import { ActivateThemeButton } from "../_components/activate-theme-button";
import { ThemeUpdatePanel } from "../_components/theme-update-panel";
import { ToggleThemeControl } from "../_components/toggle-theme-control";

type ReportIssue = { level: string; themeKey: string; message: string };

// Catálogo de temas (spec v8 §9). Dono: Fase F. Contrato (7 = Shell inteiro via adapter, 8 =
// ThemeDefinition), tema pai, saúde (erros/avisos do relatório do codegen) e habilitar/desabilitar
// — só pra quem tem platform.extensions.manage (o mesmo que toggleThemeEnabled exige).
export async function CatalogSection({ actor }: { actor: AdminActor }) {
  const themes = await listThemeStates();
  const issues = (themeReport as { issues?: ReportIssue[] }).issues ?? [];
  // Mais sensível que settings.manage (que já libera esta página inteira): "Atualizar" comita
  // no repo do site e aciona um deploy de verdade. Fora de ADMIN_BASE_PERMISSION_KEYS de
  // propósito — só aparece pra quem recebeu a permission explicitamente (docs/venore-docks.md,
  // mesmo padrão de media.purge).
  const canUpdateThemes = actor.isSuperadmin || actor.permissions.includes("platform.extensions.update");
  const canToggleThemes = actor.isSuperadmin || actor.permissions.includes("platform.extensions.manage");

  return (
    <section className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
      <ul className="space-y-3">
        {themes.map(({ manifest, enabled, isActive, canDisable, disableBlockedReason }) => {
          const entry = THEME_REGISTRY[manifest.key];
          const parent = entry?.contract === 8 ? entry.lineage[1] : undefined;
          const themeIssues = issues.filter((issue) => issue.themeKey === manifest.key);
          return (
            <li key={manifest.key} className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{manifest.name}</span>
                  {isActive && <Badge variant="secondary">Ativo</Badge>}
                  {entry && <Badge variant="outline">{entry.contract === 8 ? "v8" : "v7"}</Badge>}
                  {parent && <Badge variant="outline">herda de {parent}</Badge>}
                  {themeIssues.length > 0 && <Badge variant="destructive">{themeIssues.length} problema(s)</Badge>}
                </div>
                {/* packageVersion = version do package.json do pacote (mesma fonte que
                    getThemeUpdateStatus compara com a última tag do GitHub). */}
                <span className="text-xs text-muted-foreground/72">v{entry?.packageVersion ?? manifest.version}</span>
                {themeIssues.map((issue) => (
                  <span key={issue.message} className="text-xs text-destructive">
                    {issue.message}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {canUpdateThemes && <ThemeUpdatePanel themeKey={manifest.key} themeName={manifest.name} />}
                {!isActive && enabled && <ActivateThemeButton themeKey={manifest.key} />}
                {canToggleThemes && (
                  <ToggleThemeControl
                    themeKey={manifest.key}
                    themeName={manifest.name}
                    enabled={enabled}
                    canDisable={canDisable}
                    disableBlockedReason={disableBlockedReason}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
