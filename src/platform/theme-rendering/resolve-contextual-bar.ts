import type { ReactNode } from "react";
import { getContextualMenu, type ResolvedMenuItem } from "@/contexts/cms";
import type { ContextualBarData, ContextualMenuItemView } from "@/contexts/themes/contracts/v8";
import { hasSidebarContextualContent } from "./has-sidebar-contextual-content";
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

// Barra contextual como DADO (spec §7.5). Dono: W7 (pluginKey/isEmpty no resolver de rota, B1/B2/
// B6). Na Fase F reproduz exatamente a decisão que (platform)/layout.tsx fazia: rota de plugin com
// slot contextual → plugin; senão menu contextual do CMS com itens → menu; senão nada.
export async function resolveContextualBar(pathname: string | null, slotNode: ReactNode): Promise<ContextualBarData> {
  const pluginHasContent = hasSidebarContextualContent(pathname);
  const menuResult = pathname ? await getContextualMenu({ path: pathname }) : { success: true as const, data: [] };
  const items = menuResult.success ? menuResult.data : [];
  const source = resolveContextualBarSource(pluginHasContent, items.length);
  if (source === "plugin") return { source: "plugin", pluginKey: "", node: slotNode };
  if (source === "menu") return { source: "menu", scopePath: pathname ?? "/", items: items.map(toContextualMenuItemView) };
  return { source: "none" };
}
