import type { ResolvedMenuItem } from "@/contexts/cms";
import type { SitemapItem } from "@/contexts/themes";

// Puro de propósito: só reformata a árvore que contexts/cms já resolveu (getMenuByLocation com
// location "sitemap") pro shape que o slot de tema espera (key em vez de id). Toda regra de
// negócio — item invisível, conteúdo apagado/despublicado, permission de item "route" — já
// aconteceu em contexts/cms (menu-resolution.ts); esta função não filtra nada de novo, nem
// deriva lista a partir de conteúdo publicado (isso violaria o invariante de contexts/cms: o
// sitemap é o que o menu escolheu mostrar, não "tudo que existe").
export function toSitemapItems(items: ResolvedMenuItem[]): SitemapItem[] {
  return items.map((item) => ({
    key: item.id,
    label: item.label,
    href: item.href,
    isExternal: item.isExternal,
    opensInNewTab: item.opensInNewTab,
    children: toSitemapItems(item.children),
  }));
}
