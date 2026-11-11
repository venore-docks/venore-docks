import { PLUGIN_ROUTE_TABLES } from "@/plugins/route-registry";
import { isPluginActive } from "@/platform/plugin-engine/is-plugin-active";
import { matchPluginRoutes } from "./match-route";
import type { ResolvedPluginPageRoute } from "./resolve-admin-route";

// Mesmo formato de três estados de resolvePublicPluginRoute (o caminho pode não ser de plugin
// nenhum, casar com um plugin desativado — "reservado", 404 direto — ou casar de verdade), só que
// pra as páginas "standalone": as que fogem por completo da shell do (platform). O dispatcher
// físico é ÚNICO — src/app/ext/[...slug]/page.tsx — e passa os segmentos DEPOIS do /ext/ (ex:
// URL /ext/broadcast/out/<token> → ["broadcast","out","<token>"]). Padrões da área `standalone`
// são o caminho após /ext/, no mesmo vocabulário de `public` (ex: "broadcast/out/:token").
export type ResolveStandalonePluginRouteResult =
  | { kind: "not-a-plugin-route" }
  | { kind: "reserved-not-found" }
  | ({ kind: "matched" } & ResolvedPluginPageRoute);

export async function resolveStandalonePluginRoute(segments: string[]): Promise<ResolveStandalonePluginRouteResult> {
  for (const [pluginKey, table] of Object.entries(PLUGIN_ROUTE_TABLES)) {
    if (!table.standalone) {
      continue;
    }

    const matched = matchPluginRoutes(table.standalone, segments);
    if (!matched) {
      continue;
    }

    if (!(await isPluginActive(pluginKey))) {
      return { kind: "reserved-not-found" };
    }

    return {
      kind: "matched",
      Component: matched.route.Component,
      params: matched.params,
      generateMetadata: matched.route.generateMetadata,
    };
  }

  return { kind: "not-a-plugin-route" };
}
