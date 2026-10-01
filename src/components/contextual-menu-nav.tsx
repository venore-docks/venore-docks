import type { ResolvedMenuItem } from "@/contexts/cms";
import type { ContextualMenuItemView } from "@/contexts/themes/contracts/v8";
import { KitContextualMenuNav } from "@/theme-sdk/kit/regions/contextual-bar/contextual-bar";

// Compat: o markup do menu contextual mora no kit (KitContextualMenuNav, sobre
// ContextualMenuItemView). Este wrapper mantém a assinatura antiga (árvore ResolvedMenuItem do
// CMS) pra quem ainda monta o Shell 7.x à mão (fixtures de paridade); o caminho de render real
// passa o dado já convertido (platform/theme-rendering/resolve-contextual-bar.ts).
function toView(item: ResolvedMenuItem): ContextualMenuItemView {
  return {
    key: item.id,
    label: item.label,
    href: item.href,
    isExternal: item.isExternal,
    isActive: false,
    icon: item.icon,
    opensInNewTab: item.opensInNewTab,
    children: item.children.map(toView),
  };
}

export function ContextualMenuNav({ items }: { items: ResolvedMenuItem[] }) {
  return <KitContextualMenuNav items={items.map(toView)} />;
}

export { KitContextualMenuNav };
