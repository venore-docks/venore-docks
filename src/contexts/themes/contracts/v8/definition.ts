import type { ComponentType } from "react";
import type { StaticImageData } from "next/image";
import type { ColorPalette, ThemeManifest, ThemeShellProps } from "../types";
import type { ThemeLayoutPreset } from "./enums";
import type { ThemeMessages } from "./i18n";
import type { ThemeLayoutComponent } from "./layout";
import type { ThemeBlockRenderers } from "./page-builder";
import type {
  BreadcrumbsRegionProps,
  ContextualBarRegionProps,
  FooterRegionProps,
  HeaderRegionProps,
  MobileNavRegionProps,
  RailRegionProps,
  RegionOverride,
  UserMenuRegionProps,
} from "./regions";
import type { ThemeStates } from "./states";
import type { ThemeTemplates } from "./templates";

// Shell 7.x (o único componente que um tema 7.x exporta).
export type ThemeShellComponent = ComponentType<ThemeShellProps>;

export type ThemeRegionOverrides = Partial<{
  header: RegionOverride<HeaderRegionProps>;
  rail: RegionOverride<RailRegionProps>;
  footer: RegionOverride<FooterRegionProps>;
  breadcrumbs: RegionOverride<BreadcrumbsRegionProps>;
  userMenu: RegionOverride<UserMenuRegionProps>;
  contextualBar: RegionOverride<ContextualBarRegionProps>;
  mobileNav: RegionOverride<MobileNavRegionProps>;
}>;

export type ThemeAssets = {
  ogImage?: StaticImageData;
  icon192?: StaticImageData;
  icon512?: StaticImageData;
  maskable512?: StaticImageData;
  appleIcon?: StaticImageData;
};

// O único conceito novo da v8 (invariante §0.1): todo campo é opcional e cai no kit, que É o
// venore-slime de hoje.
export type ThemeDefinition = {
  manifest: ThemeManifest; // themeContractVersion ^8
  layout?: ThemeLayoutPreset | ThemeLayoutComponent; // default manifest.layout.preset ?? "topbar"
  regions?: ThemeRegionOverrides;
  templates?: ThemeTemplates;
  states?: ThemeStates;
  blockRenderers?: () => Promise<ThemeBlockRenderers>; // lazy, server-only
  messages?: ThemeMessages;
  assets?: ThemeAssets;
  colorPalettes?: ColorPalette[];
};
