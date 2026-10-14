import { cache } from "react";
import { PLUGIN_ROUTE_TABLES } from "@/plugins/route-registry";
import { getActivePluginKeys } from "@/platform/plugin-engine/get-active-plugin-keys";
import { matchPluginRoutes } from "./match-route";
import type { ResolvedPluginPageRoute } from "./resolve-admin-route";

export type ResolvedSidebarContextualPluginRoute = ResolvedPluginPageRoute & { pluginKey: string };

// Slot paralelo @sidebarContextual (coluna contextual do layout) e barra contextual como dado
// (platform/theme-rendering/resolve-contextual-bar.ts). Diferente de resolvePublicPluginRoute, aqui
// não há estado "reserved-not-found": um caminho que não casa, casa com um plugin DESATIVADO (B1)
// ou casa com uma entrada cujo `isEmpty(params)` devolve true (B6) simplesmente não é conteúdo de
// plugin — devolve null e quem chama segue pro menu contextual do CMS. O dispatcher físico é único:
// src/app/(platform)/@sidebarContextual/[...slug]/page.tsx. Padrões da área `sidebarContextual` são
// caminhos completos (ex: "academy/:courseSlug/:lessonId").
//
// Memoizado por request (React cache(), chave = segmentos serializados): o layout (barra contextual) e o slot
// paralelo pedem a mesma resolução no mesmo request, e isEmpty pode consultar o banco.
export async function resolveSidebarContextualPluginRoute(
  segments: string[],
): Promise<ResolvedSidebarContextualPluginRoute | null> {
  return resolveByPath(JSON.stringify(segments));
}

const resolveByPath = cache(async (key: string): Promise<ResolvedSidebarContextualPluginRoute | null> => {
  const segments = JSON.parse(key) as string[];
  const activeKeys = await getActivePluginKeys();

  for (const [pluginKey, table] of Object.entries(PLUGIN_ROUTE_TABLES)) {
    if (!table.sidebarContextual || !activeKeys.has(pluginKey)) {
      continue;
    }

    const matched = matchPluginRoutes(table.sidebarContextual, segments);
    if (!matched) {
      continue;
    }

    if (matched.route.isEmpty) {
      let empty = false;
      try {
        empty = await matched.route.isEmpty(matched.params);
      } catch {
        // isEmpty que falha não esconde a coluna do plugin: o Component decide o que mostrar.
        empty = false;
      }
      if (empty) {
        return null;
      }
    }

    return { pluginKey, Component: matched.route.Component, params: matched.params };
  }

  return null;
});
