import { getPluginsPageData } from "@/platform/admin-shell/get-plugins-page-data";
import { previewPluginDisable } from "@/platform/plugin-engine/preview-plugin-disable";
import { registerPlugins } from "@/platform/plugin-engine/register-plugins";
import { getActiveThemeOutletDiagnostics } from "@/platform/theme-rendering/outlet-diagnostics";
import { EmptyState } from "@/components/empty-state";
import { Blocks } from "lucide-react";
import { InstallPluginControl } from "./_components/install-plugin-control";
import { SeedPluginControl } from "./_components/seed-plugin-control";
import { UninstallPluginControl } from "./_components/uninstall-plugin-control";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  available: "Disponível",
  invalid: "Manifesto inválido",
  incompatible: "Incompatível com o core",
  dependency_missing: "Dependência ausente",
  cycle: "Dependência cíclica",
  disabled: "Desabilitado pelo admin",
};

const STATUS_CLASSNAME: Record<string, string> = {
  active: "bg-accent/14 text-foreground",
  available: "bg-muted text-muted-foreground",
  invalid: "bg-destructive/14 text-destructive",
  incompatible: "bg-destructive/14 text-destructive",
  dependency_missing: "bg-warning-soft text-warning",
  cycle: "bg-warning-soft text-warning",
  disabled: "bg-muted text-muted-foreground",
};

export default async function PluginsAdminPage() {
  const gate = await getPluginsPageData();

  if (!gate.granted) {
    return (
      <div className="rounded-panel border border-border bg-card ui-panel-padding-roomy text-center">
        <h1 className="text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Você não tem permissão para ver os plugins instalados.</p>
      </div>
    );
  }

  const report = await registerPlugins();

  // Preview de consequência só faz sentido pra quem tem manifesto válido e já está instalado
  // (invalid_manifest não tem dado confiável pra prever; "available" nem contribui nada ainda) —
  // computado pra todos de uma vez, não sob demanda no dialog, porque a tela já é pequena o
  // bastante (poucos plugins instalados).
  const previewsByKey = new Map(
    await Promise.all(
      report.entries
        .filter((entry) => entry.manifest && entry.status !== "available")
        .map(async (entry) => [entry.key, await previewPluginDisable(entry.key)] as const),
    ),
  );

  // Outlets de tema declarados por plugins que o tema ativo não renderiza (spec v8 §7.4).
  const outletDiagnostics = await getActiveThemeOutletDiagnostics(
    Object.fromEntries(report.entries.filter((entry) => entry.manifest).map((entry) => [entry.key, entry.manifest!])),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Plugins</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plugins presentes no código (src/plugins/registry.ts). Cada um pode estar Disponível (não instalado),
          Habilitado ou Desabilitado — instalar roda as migrations do plugin no banco. O status abaixo também
          reflete a validação de manifesto, compatibilidade e dependências feita no registro.
        </p>
      </div>

      {report.entries.length === 0 ? (
        <EmptyState
          icon={<Blocks className="size-8" strokeWidth={1.5} />}
          title="Nenhum plugin instalado"
          description="Plugins são instalados em código — adicione uma entrada em src/plugins/registry.ts para começar."
        />
      ) : (
        <ul className="space-y-3">
          {report.entries.map((entry) => (
            <li key={entry.key} className="rounded-panel border border-border bg-card ui-panel-padding-roomy">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{entry.manifest?.name ?? entry.key}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.key}
                    {entry.manifest?.version && <> · v{entry.manifest.version}</>}
                  </p>
                  {entry.manifest?.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{entry.manifest.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSNAME[entry.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {STATUS_LABEL[entry.status] ?? entry.status}
                  </span>
                  {entry.manifest && entry.status === "available" && (
                    <InstallPluginControl
                      pluginKey={entry.key}
                      pluginName={entry.manifest.name}
                      hasMigrations={Boolean(entry.manifest.migrationsPath)}
                      hasExampleSeed={Boolean(entry.manifest.seeds?.length)}
                    />
                  )}
                  {entry.manifest && entry.status !== "available" && (
                    <UninstallPluginControl
                      pluginKey={entry.key}
                      pluginName={entry.manifest.name}
                      enabled={entry.status !== "disabled"}
                      consequences={
                        previewsByKey.get(entry.key) ?? {
                          navigationLabels: [],
                          permissionLabels: [],
                          affectedUserCount: 0,
                          blockedByDependents: [],
                        }
                      }
                    />
                  )}
                  {entry.manifest && entry.status !== "available" && Boolean(entry.manifest.seeds?.length) && (
                    <SeedPluginControl pluginKey={entry.key} pluginName={entry.manifest.name} />
                  )}
                </div>
              </div>
              {entry.errors.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3">
                  {entry.errors.map((error, index) => (
                    <li key={index} className="text-xs text-destructive">
                      {error}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {outletDiagnostics.items.length > 0 && (
        <section
          aria-labelledby="plugin-outlet-diagnostics"
          className="rounded-panel border border-warning-border bg-warning-soft ui-panel-padding-roomy"
        >
          <h2 id="plugin-outlet-diagnostics" className="text-sm font-semibold text-warning">
            Outlets que o tema ativo não exibe
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O tema &ldquo;{outletDiagnostics.themeName}&rdquo; não renderiza estes pontos de extensão — a contribuição do
            plugin existe, mas não aparece no site enquanto este tema estiver ativo.
          </p>
          <ul className="mt-3 space-y-1">
            {outletDiagnostics.items.map((item) => (
              <li key={`${item.pluginKey}:${item.key}:${item.outlet}`} className="text-xs text-foreground">
                <span className="font-medium">{item.pluginKey}</span> · {item.key} →{" "}
                <code className="font-mono">{item.outlet}</code>
                {item.reason === "unknown-outlet" ? " (outlet desconhecido)" : ""}
                {item.source === "manifest" ? " · declarado no manifesto" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
