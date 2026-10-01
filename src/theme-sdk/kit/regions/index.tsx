import type { BreadcrumbItem } from "@/contexts/themes/contracts/types";
import type { RegionCommon, ThemeStrings } from "@/contexts/themes/contracts/v8";
import { Breadcrumbs } from "./breadcrumbs/breadcrumbs";
import { ContextualBar } from "./contextual-bar/contextual-bar";
import { FooterSlot } from "./footer/footer";
import { MobileNav } from "./mobile-nav/mobile-nav";
import { SidebarLeftSlot } from "./rail/rail";
import { HeaderSlot } from "./site-header/site-header";
import { UserMenu } from "./user-menu/user-menu";

// Regiões do kit (spec §2.5). Cada uma aceita as props v8 da região (HeaderRegionProps,
// RailRegionProps, …) e também o shape 7.x de slot (o Shell do kit ainda as usa assim) — os campos
// v8 são opcionais nos componentes. É o `Default` que um override de tema recebe. Dono: W3 (W7 na
// barra contextual).
export const KitHeader = HeaderSlot;
export const KitRail = SidebarLeftSlot;
export const KitFooter = FooterSlot;
export const KitUserMenu = UserMenu;
export const KitContextualBar = ContextualBar;
export const KitMobileNav = MobileNav;

// Trilha do kit: só o <nav>. O JSON-LD é do core (spec §2.5), renderizado pelo ThemeRenderer.
export function KitBreadcrumbs({ items, strings }: { items: BreadcrumbItem[]; strings?: ThemeStrings } & Partial<RegionCommon>) {
  return <Breadcrumbs breadcrumbs={items} breadcrumbsJsonLd={null} strings={strings} />;
}

export type { KitHeaderProps } from "./site-header/site-header";
export type { KitRailProps } from "./rail/rail";
export type { KitFooterProps } from "./footer/footer";
export type { KitUserMenuProps } from "./user-menu/user-menu";
export type { KitMobileNavProps } from "./mobile-nav/mobile-nav";
