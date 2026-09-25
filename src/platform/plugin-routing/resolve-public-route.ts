import { PLUGIN_ROUTE_TABLES } from "@/plugins/route-registry";
import { isPluginActive } from "@/platform/plugin-engine/is-plugin-active";
import { matchPluginRoutes } from "./match-route";
import type { ResolvedPluginPageRoute } from "./resolve-admin-route";

// Resultado de três estados, não um boolean/null simples: o caminho completo pode (1) não
// pertencer a plugin nenhum — o catch-all do CMS segue seu fluxo normal de categoria/entry; (2)
// casar com o padrão de um plugin desativado — o caminho está "reservado" pro plugin, então vira
// notFound() direto, nunca cai pra procurar conteúdo do CMS com aquele mesmo slug (mesmo
// comportamento de antes, quando cada page.tsx do plugin chamava isPluginActive()+notFound() por
// conta própria); (3) casou de verdade com um plugin ativo.
export type ResolvePublicPluginRouteResult =
  | { kind: "not-a-plugin-route" }
  | { kind: "reserved-not-found" }
  | ({ kind: "matched" } & ResolvedPluginPageRoute);

// Padrões de "public" são caminhos completos (ex: "academy/:courseSlug", "cursos"), não relativos
// a um prefixo = key do plugin — um plugin pode ter rota pública em mais de um "namespace" de URL
// (academy tem "academy/**" E "cursos", uma vitrine separada), então tentamos o caminho inteiro
// contra a tabela de cada plugin registrado, não só o primeiro segmento.
export async function resolvePublicPluginRoute(segments: string[]): Promise<ResolvePublicPluginRouteResult> {
  for (const [pluginKey, table] of Object.entries(PLUGIN_ROUTE_TABLES)) {
    if (!table.public) {
      continue;
    }

    const matched = matchPluginRoutes(table.public, segments);
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
