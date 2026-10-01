import type { ComponentType, ReactNode } from "react";
import type {
  BreadcrumbItem,
  FooterSlotProps,
  HeaderSlotProps,
  HeaderUserInfo,
  MainNavItem,
  NavItem,
  NavMode,
  SidebarLeftSlotProps,
} from "../types";
import type { ThemeMobileNavMode } from "./enums";
import type { ThemeStrings } from "./i18n";
import type { ThemeOptionValue } from "./options";

// Props das regiões (spec §2.5). Serializáveis (invariante §0.7): só dado, ReactNode já
// renderizado e server actions. `t` é helper puro sobre `strings`.
export type RegionCommon = {
  strings: ThemeStrings;
  locale: string;
  dir: "ltr" | "rtl";
  options: Readonly<Record<string, ThemeOptionValue>>;
  area: "public" | "admin";
};
export type HeaderRegionProps = HeaderSlotProps &
  RegionCommon & {
    sidebarCollapse: { collapsed: boolean; onToggleCollapsed: () => Promise<void> } | null;
    headerNavVisibleFrom: "always" | "md" | "lg";
    slots: {
      userMenu: ReactNode;
      mobileNavToggle: ReactNode;
      breadcrumbs: ReactNode | null;
      outletStart: ReactNode;
      outletEnd: ReactNode;
    };
  };
export type RailRegionProps = SidebarLeftSlotProps &
  RegionCommon & {
    headerNavItems: NavItem[];
    collapseControl: "rail" | "header" | "none";
    slots: { outletTop: ReactNode; outletBottom: ReactNode };
  };
export type FooterRegionProps = FooterSlotProps & RegionCommon & { slots: { outletTop: ReactNode; outletBottom: ReactNode } };
// JSON-LD da trilha é do core, nunca da região.
export type BreadcrumbsRegionProps = RegionCommon & { items: BreadcrumbItem[] };
export type UserMenuRegionProps = RegionCommon & {
  user: HeaderUserInfo;
  canAccessAdmin: boolean;
  onSignOut: () => Promise<void>;
  userNavItems: NavItem[];
  slots: { outletItems: ReactNode };
};
export type ContextualMenuItemView = {
  key: string;
  label: string;
  href: string | null;
  isExternal: boolean;
  isActive: boolean;
  children: ContextualMenuItemView[];
};
export type ContextualBarData =
  | { source: "none" }
  | { source: "menu"; scopePath: string; items: ContextualMenuItemView[] }
  | { source: "plugin"; pluginKey: string; node: ReactNode };
export type ContextualBarRegionProps = RegionCommon & {
  data: Exclude<ContextualBarData, { source: "none" }>;
  placement: "side" | "top";
  mobile: "top-collapsible" | "bottom" | "hidden";
  slots: { outletTop: ReactNode; outletBottom: ReactNode };
};
export type MobileNavRegionProps = RegionCommon & {
  mode: ThemeMobileNavMode;
  navMode: NavMode;
  items: MainNavItem[];
  headerNavItems: NavItem[];
  railNode: ReactNode | null;
  navModeSwitch: ReactNode;
};
/** Override de região: server component, recebe o componente padrão do kit pra embrulhar. */
export type RegionOverride<P> = ComponentType<P & { Default: ComponentType<P> }>;
