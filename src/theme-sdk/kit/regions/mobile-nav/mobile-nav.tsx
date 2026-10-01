import type { MainNavItem } from "@/contexts/themes/contracts/types";
import type { HeaderRegionProps, MobileNavRegionProps } from "@/contexts/themes/contracts/v8";
import { MobileBottomBar, MOBILE_BOTTOM_BAR_MAX_ITEMS, type BottomBarItem } from "./mobile-bottom-bar";
import { MobileNavList } from "./mobile-nav-list";
import { MobileNavOverlay } from "./mobile-nav-overlay";

export type KitMobileNavProps = MobileNavRegionProps & {
  // Extra do kit: quando o menu do header some no mobile ("md"/"lg"), a camada mobile o mostra.
  headerNavVisibleFrom?: HeaderRegionProps["headerNavVisibleFrom"];
};

// Região mobileNav do kit (spec v8 §7.8) — três modos, cada um com UM <nav> rotulado e um controle
// com aria-expanded:
//   "drawer"     → a navegação mobile É a rail em off-canvas (MobileNavDrawer dentro da região rail,
//                  aberta pelo hambúrguer do header) — com rail presente (`railNode`), esta região
//                  não acrescenta markup (paridade com o slime). Sem rail, monta o próprio drawer.
//   "bottom-bar" → barra fixa embaixo (até 5 itens + "Mais"); o header fica sem hambúrguer.
//   "fullscreen" → sobreposição de tela cheia aberta pelo hambúrguer do header.
// Server component: só monta dados/JSX; o estado vive nas peças client.
export function MobileNav({ mode, items, headerNavItems, railNode, navModeSwitch, strings, headerNavVisibleFrom = "always" }: KitMobileNavProps) {
  const extraHeaderNav = headerNavVisibleFrom === "always" ? [] : headerNavItems;

  if (mode === "drawer") {
    if (railNode != null) return null;
    if (items.length === 0 && extraHeaderNav.length === 0 && navModeSwitch == null) return null;
    return (
      <MobileNavOverlay variant="drawer" strings={strings}>
        <div className="space-y-4">
          {navModeSwitch}
          <MobileNavList items={items} headerNavItems={extraHeaderNav} />
        </div>
      </MobileNavOverlay>
    );
  }

  if (mode === "fullscreen") {
    return (
      <MobileNavOverlay variant="fullscreen" strings={strings}>
        <div className="mx-auto w-full max-w-md space-y-6">
          {navModeSwitch}
          <MobileNavList items={items} headerNavItems={extraHeaderNav} />
        </div>
      </MobileNavOverlay>
    );
  }

  const { barItems, rest } = splitBottomBarItems(items);
  const hasMore = rest.length > 0 || extraHeaderNav.length > 0 || navModeSwitch != null;
  return (
    <MobileBottomBar
      items={barItems}
      strings={strings}
      more={
        hasMore ? (
          <div className="space-y-4">
            {navModeSwitch}
            <MobileNavList items={rest} headerNavItems={extraHeaderNav} />
          </div>
        ) : null
      }
    />
  );
}

// Até 5 links de primeiro nível na barra; agregadores (href null) e o excedente vão pro "Mais".
export function splitBottomBarItems(items: MainNavItem[]): { barItems: BottomBarItem[]; rest: MainNavItem[] } {
  const barItems: BottomBarItem[] = [];
  const rest: MainNavItem[] = [];
  for (const item of items) {
    if (item.href !== null && barItems.length < MOBILE_BOTTOM_BAR_MAX_ITEMS) {
      barItems.push({ key: item.key, label: item.label, href: item.href, icon: item.icon, isExternal: item.isExternal, opensInNewTab: item.opensInNewTab });
    } else {
      rest.push(item);
    }
  }
  return { barItems, rest };
}
