// Precedência entre os dois mecanismos de Contextual Bar: conteúdo de PLUGIN (rota declarada em
// PLUGIN_ROUTE_TABLES[...].sidebarContextual de um plugin ATIVO e não vazio — ver
// resolveSidebarContextualPluginRoute) é tipicamente mais específico/interativo (ex: trilha de
// aulas da Academy) e tem prioridade sobre o Menu Contextual do CMS (/admin/cms/menus, location
// "contextual"), que funciona como fallback genérico configurável pelo admin. Função pura (sem
// React), consumida por resolve-contextual-bar.ts, que monta o ContextualBarData.
export type ContextualBarSource = "plugin" | "menu" | "none";

export function resolveContextualBarSource(pluginHasContent: boolean, contextualMenuItemCount: number): ContextualBarSource {
  if (pluginHasContent) return "plugin";
  if (contextualMenuItemCount > 0) return "menu";
  return "none";
}
