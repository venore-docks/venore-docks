// Superfície pública das regiões/layouts do kit (@venore/theme-sdk/kit). Dono: W3.
export { KitHeader, KitRail, KitFooter, KitUserMenu, KitContextualBar, KitMobileNav, KitBreadcrumbs } from "../regions";
export type { KitHeaderProps, KitRailProps, KitFooterProps, KitUserMenuProps, KitMobileNavProps } from "../regions";
export { KitContextualMenuNav } from "../regions/contextual-bar/contextual-bar";
export { KitNavModeSwitch } from "../regions/rail/rail";
export { splitBottomBarItems } from "../regions/mobile-nav/mobile-nav";
export { KIT_REGION_STRINGS_PT_BR, regionText } from "../regions/region-strings";
export {
  KIT_LAYOUTS,
  TopbarLayout,
  RailLayout,
  ContentFrame,
  ContentSlot,
  SkipLink,
  KIT_MAIN_CONTENT_ID,
  Shell as KitShell,
  type KitLayoutProps,
  type ContextualMobileMode,
} from "../layouts";
export { ThemeOutlet } from "../outlet";
export { PlatformBrand } from "../platform-brand";
