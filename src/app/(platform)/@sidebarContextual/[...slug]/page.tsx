import { resolveSidebarContextualPluginRoute } from "@/platform/plugin-routing/resolve-sidebar-contextual-route";

// Dispatcher único do slot paralelo @sidebarContextual — casa QUALQUER rota (com >= 1 segmento)
// contra a área `sidebarContextual` das route-tables de plugin (via
// resolveSidebarContextualPluginRoute) e renderiza o componente do plugin, ou null. Catch-all
// obrigatório ([...slug], não [[...slug]]): a raiz "/" já é coberta por default.tsx, e um optional
// catch-all colidiria com a page "/" do route group. Nenhum segmento de plugin fica físico aqui.
// O layout ((platform)/layout.tsx) decide, pela barra contextual como dado
// (platform/theme-rendering/resolve-contextual-bar.ts, mesma resolução memoizada), se sequer
// mostra a coluna. `dynamic` é export direto (AGENTS.md §1.1).
export const dynamic = "force-dynamic";

export default async function SidebarContextualSlot({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const resolved = await resolveSidebarContextualPluginRoute(slug);
  if (!resolved) {
    return null;
  }

  const { Component, params: routeParams } = resolved;
  return <Component params={Promise.resolve(routeParams)} searchParams={Promise.resolve({})} />;
}
