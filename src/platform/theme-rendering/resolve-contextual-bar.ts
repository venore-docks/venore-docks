import type { ReactNode } from "react";
import { getContextualMenu, type ResolvedMenuItem } from "@/contexts/cms";
import type { ContextualBarData, ContextualMenuItemView } from "@/contexts/themes/contracts/v8";
import { resolveSidebarContextualPluginRoute } from "@/platform/plugin-routing/resolve-sidebar-contextual-route";
import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
import { resolveContextualBarSource } from "./resolve-contextual-bar-source";

export function toContextualMenuItemView(item: ResolvedMenuItem): ContextualMenuItemView {
  return {
    key: item.id,
    label: item.label,
    href: item.href,
    isExternal: item.isExternal,
    isActive: false,
    icon: item.icon,
    opensInNewTab: item.opensInNewTab,
    children: item.children.map(toContextualMenuItemView),
  };
}

// O header x-breadcrumb-pathname chega cru (percent-encoded); as route-tables de plugin comparam
// segmentos decodificados (mesma forma que o Next entrega em `params.slug` ao slot paralelo).
export function toPathSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

// Barra contextual como DADO (spec v8 §7.5). Precedência: plugin > menu do CMS > nada.
// - B1: só conta como plugin a rota de um plugin ATIVO (resolveSidebarContextualPluginRoute
//   ignora inativos) — um padrão de plugin desligado cai pro menu do CMS em vez de mostrar uma
//   coluna vazia.
// - B6: entrada com `isEmpty(params) === true` também não conta; e `none` é um valor explícito, que
//   o kit e o adapter 7.x traduzem em "nenhum <aside>" (nunca um nó React que renderiza null).
// - B2: o menu é casado por getContextualMenu com caminho e escopo normalizados.
// Decidir pela URL (e não pelo valor do slot paralelo, que nunca chega como null literal) continua
// sendo o motivo do desenho: o slotNode só é usado como conteúdo depois que a decisão está tomada.
export async function resolveContextualBar(pathname: string | null, slotNode: ReactNode): Promise<ContextualBarData> {
  if (!pathname) return { source: "none" };

  const segments = toPathSegments(pathname);
  const pluginRoute = segments.length > 0 ? await resolveSidebarContextualPluginRoute(segments) : null;
  // Rota de plugin vence: o menu nem é consultado.
  const menuResult = pluginRoute ? null : await getContextualMenu({ path: pathname });
  const items = menuResult?.success ? menuResult.data : [];

  const source = resolveContextualBarSource(pluginRoute !== null, items.length);
  if (source === "plugin" && pluginRoute) {
    return { source: "plugin", pluginKey: pluginRoute.pluginKey, node: slotNode };
  }
  if (source === "menu") {
    return { source: "menu", scopePath: normalizePathPrefix(pathname), items: items.map(toContextualMenuItemView) };
  }
  return { source: "none" };
}
