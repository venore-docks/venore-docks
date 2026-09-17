// Precedência entre os dois mecanismos desconectados de Contextual Bar (Known Gap resolvido
// nesta sessão): conteúdo de PLUGIN (rota declarada em PLUGIN_ROUTE_TABLES[...].sidebarContextual,
// via hasSidebarContextualContent) é tipicamente mais específico/interativo (ex: trilha de aulas
// da Academy) e tem prioridade sobre o Menu Contextual do CMS (/admin/cms/menus, location
// "contextual"), que funciona como fallback genérico configurável pelo admin. Função pura
// (sem React) pra ficar testável sem precisar montar JSX — app/(platform)/layout.tsx decide o
// que renderizar a partir do resultado.
export type ContextualBarSource = "plugin" | "menu" | "none";

export function resolveContextualBarSource(pluginHasContent: boolean, contextualMenuItemCount: number): ContextualBarSource {
  if (pluginHasContent) return "plugin";
  if (contextualMenuItemCount > 0) return "menu";
  return "none";
}
