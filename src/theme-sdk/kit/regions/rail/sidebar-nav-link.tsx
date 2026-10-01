"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MainNavItem } from "@/contexts/themes/contracts/types";
import { cn } from "@/lib/utils";
import { NavIcon } from "@/platform/nav-icons/NavIcon";
import { SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES, SIDEBAR_COLLAPSE_TOOLTIP_LABEL_CLASSES } from "./sidebar-collapse-tooltip";

// Único pedaço client do item de nav: aria-current depende da rota atual, que um server component
// de layout não tem como ler sem middleware escrevendo um header dedicado (não existe um hoje, e
// criar um só pra isso seria maior que o problema). usePathname() é o jeito direto do App Router —
// funciona também durante o SSR deste Client Component, por isso aria-current (e o estado inicial
// aberto/fechado do accordion abaixo) já chegam corretos no primeiro HTML, sem salto pós-hidratação.
//
// 180px de max-width pro rótulo (não um número solto — é o que sobra dentro de
// --sidebar-width-expanded=280px depois do padding do frame (px-5=20px×2), do padding do item
// (px-3=12px×2) e do ícone+gap (20px+12px), replicando a matemática do protótipo de referência
// pixel a pixel: 280 − 40 − 24 − 32 = 184 ≈ 180). Cortar o texto era o bug desta sessão. Sem barra
// de marcação (border-l) nem em hover/active nem fixa — removida por pedido desta sessão, o
// destaque de item ativo/hover é só bg/text (bg-accent/14, text-primary).
function isDescendantActive(item: MainNavItem, pathname: string | null): boolean {
  if (item.href === null) {
    return item.children.some((child) => isDescendantActive(child, pathname));
  }
  return item.href === pathname;
}

export function SidebarNavLink({ item, collapsed, isAdmin }: { item: MainNavItem; collapsed: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  // Hooks precisam rodar sempre na mesma ordem independente do branch abaixo (Rules of Hooks) —
  // por isso useState fica aqui em cima, mesmo só sendo consumido no branch de agregador.
  const isActiveAncestor = item.href === null && isDescendantActive(item, pathname);
  const [expanded, setExpanded] = useState(isActiveAncestor);

  // item.href === null é o agregador (menu_items.targetType "label", contexts/cms): nunca navega,
  // abre/fecha os filhos no próprio main-nav (accordion) — decisão desta sessão em vez de
  // reaproveitar o pill Site/Admin, que troca navMode inteiro e não serve pra expor filhos de um
  // único item. Aberto por padrão quando a rota atual é de um descendente, pra chegar já expandido
  // no primeiro HTML (mesmo raciocínio de aria-current acima).
  if (item.href === null) {
    const contentId = `sidebar-nav-group-${item.key}`;

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={contentId}
          data-active-ancestor={isActiveAncestor ? "true" : undefined}
          className={cn(
            "group/sidebar-collapse-target relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ui-motion-base outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActiveAncestor ? "font-semibold text-primary" : "font-medium text-muted-foreground",
            "hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground",
          )}
        >
          <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
            <NavIcon iconKey={item.icon} className="size-4 shrink-0" />
          </span>
          <span
            className={cn(
              "flex-1",
              SIDEBAR_COLLAPSE_TOOLTIP_LABEL_CLASSES,
              collapsed && SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES,
            )}
          >
            {item.label}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 ui-motion-base",
              expanded && "rotate-180",
              collapsed && SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES,
            )}
          />
        </button>
        {expanded && (
          <div id={contentId} className={cn("ml-8 space-y-1", collapsed && "lg:ml-0")}>
            {item.children.map((child) => (
              <SidebarNavLink key={child.key} item={child} collapsed={collapsed} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = !item.isExternal && pathname === item.href;
  const linkClassName = cn(
    "group/sidebar-collapse-target relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ui-motion-base outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-primary/10 font-semibold text-primary"
      : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground",
  );
  const content = (
    <>
      <span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center">
        <NavIcon iconKey={item.icon} className="size-4 shrink-0" />
      </span>
      <span className={cn(SIDEBAR_COLLAPSE_TOOLTIP_LABEL_CLASSES, collapsed && SIDEBAR_COLLAPSE_TOOLTIP_COLLAPSED_CLASSES)}>
        {item.label}
      </span>
    </>
  );

  // Item externo (menu_items.targetType "external" — contexts/cms) nunca passa pelo router do
  // Next: <Link> navegaria client-side pra uma URL fora da app. Abre sempre em nova aba (regra de
  // negócio pedida pro CMS, menu-resolution.ts já resolve isso em opensInNewTab). Item interno com
  // opensInNewTab (checkbox do editor) continua <Link> — só ganha target/rel.
  if (item.isExternal) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      target={item.opensInNewTab ? "_blank" : undefined}
      rel={item.opensInNewTab ? "noopener noreferrer" : undefined}
      className={linkClassName}
    >
      {content}
    </Link>
  );
}
