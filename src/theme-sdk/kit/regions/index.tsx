import type { BreadcrumbItem } from "@/contexts/themes/contracts/types";
import type { ThemeStrings } from "@/contexts/themes/contracts/v8";
import { Breadcrumbs } from "./breadcrumbs/breadcrumbs";
import { ContextualBar } from "./contextual-bar/contextual-bar";
import { FooterSlot } from "./footer/footer";
import { MobileNav } from "./mobile-nav/mobile-nav";
import { SidebarLeftSlot } from "./rail/rail";
import { HeaderSlot } from "./site-header/site-header";
import { UserMenu } from "./user-menu/user-menu";

// Regiões do kit (spec §2.5). Na Fase F as regiões ainda têm a assinatura 7.x (+ `strings`), que é
// subconjunto das props v8 — ComponentType<HeaderRegionProps> aceita. Dono: W3 (W7 na barra
// contextual).
export const KitHeader = HeaderSlot;
export const KitRail = SidebarLeftSlot;
export const KitFooter = FooterSlot;
export const KitUserMenu = UserMenu;
export const KitContextualBar = ContextualBar;
export const KitMobileNav = MobileNav;

// Trilha do kit: só o <nav>. O JSON-LD é do core (spec §2.5), renderizado pelo ThemeRenderer.
export function KitBreadcrumbs({ items, strings }: { items: BreadcrumbItem[]; strings?: ThemeStrings }) {
  return <Breadcrumbs breadcrumbs={items} breadcrumbsJsonLd={null} strings={strings} />;
}
