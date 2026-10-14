export { getActiveThemeHandler as getActiveTheme } from "./features/active-theme/get-active-theme/handler";
export { activateThemeHandler as activateTheme } from "./features/active-theme/activate-theme/handler";
export { getActiveColorPaletteHandler as getActiveColorPalette } from "./features/color-palette/get-active-color-palette/handler";
export { activateColorPaletteHandler as activateColorPalette } from "./features/color-palette/activate-color-palette/handler";
export { themesAdminNavigationItems } from "./admin-navigation";
// Config de tema v8 (published/draft/history) — fatia própria, dono W6 (spec §11).
export * from "./features/theme-config/public";

export type { GetActiveThemeResult } from "./features/active-theme/get-active-theme/types";
export type { ActivateThemeInput, ActivateThemeResult } from "./features/active-theme/activate-theme/types";
export type { GetActiveColorPaletteResult } from "./features/color-palette/get-active-color-palette/types";
export type { ActivateColorPaletteInput, ActivateColorPaletteResult } from "./features/color-palette/activate-color-palette/types";

export { themesBreadcrumbSegments } from "./breadcrumbs";

export type {
  ThemeManifest,
  ThemeColorMode,
  ThemeCapabilities,
  BrandAesthetics,
  ActiveThemeState,
  BreadcrumbItem,
  HeaderSlotProps,
  HeaderBrand,
  HeaderBrandMode,
  HeaderBrandPosition,
  HeaderUserInfo,
  FooterSlotProps,
  FooterBrand,
  ContentSlotProps,
  SidebarLeftSlotProps,
  ThemeShellProps,
  NavItem,
  MainNavItem,
  NavGroup,
  NavMode,
  SitemapItem,
  PaletteColorToken,
  PaletteColorTokens,
  ColorPalette,
  ActiveColorPaletteState,
} from "./contracts/types";
export {
  CURRENT_THEME_CONTRACT_VERSION,
  SUPPORTED_THEME_CONTRACT_RANGE,
  LEGACY_THEME_CONTRACT_RANGE,
  V8_THEME_CONTRACT_RANGE,
} from "./contracts/contract-version";
// Contrato v8 (tipos + schema zod do documento de config).
export * from "./contracts/v8";
