import type { ComponentType, ReactNode } from "react";
import type { ContextualBarPlacement, PageWidth } from "./enums";
import type { RegionCommon } from "./regions";

// Layout (spec §2.6). Componente de layout é server component.
export type ResolvedPageLayout = {
  width: PageWidth;
  showRail: boolean;
  contextualPlacement: ContextualBarPlacement;
  template: string | null;
};
export const DEFAULT_PAGE_LAYOUT: ResolvedPageLayout = {
  width: "contained",
  showRail: true,
  contextualPlacement: "side",
  template: null,
};
export type ThemeLayoutProps = RegionCommon & {
  regions: {
    skipLink: ReactNode;
    header: ReactNode;
    rail: ReactNode | null;
    footer: ReactNode;
    breadcrumbs: ReactNode | null;
    contextualBar: ReactNode | null;
    mobileNav: ReactNode | null;
  };
  page: ResolvedPageLayout;
  children: ReactNode; // já embrulhado com content.before/after
};
export type ThemeLayoutComponent = ComponentType<ThemeLayoutProps>;
