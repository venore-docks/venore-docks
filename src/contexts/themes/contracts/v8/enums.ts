// Contrato de tema 8.0.0 (docs/themes/theme-system-v8.md, spec §2.1). Tudo em contracts/v8 é
// ADIÇÃO opcional ao contrato 7.x (contracts/types.ts fica intocado — invariante §0.2).
export type ThemeRegionKey = "header" | "rail" | "footer" | "breadcrumbs" | "userMenu" | "contextualBar" | "mobileNav";
export const THEME_REGION_KEYS: readonly ThemeRegionKey[] = [
  "header",
  "rail",
  "footer",
  "breadcrumbs",
  "userMenu",
  "contextualBar",
  "mobileNav",
];
export type ThemeTokenRegion = "header" | "rail" | "contextual" | "content" | "footer";
export const THEME_TOKEN_REGIONS: readonly ThemeTokenRegion[] = ["header", "rail", "contextual", "content", "footer"];
export type ThemeTemplateKey = "home" | "entry" | "category" | "account" | "login" | "notFound";
export const THEME_TEMPLATE_KEYS: readonly ThemeTemplateKey[] = ["home", "entry", "category", "account", "login", "notFound"];
export type ThemePageStateKey = "loading" | "error" | "empty" | "forbidden" | "maintenance" | "notFound";
// topbar = Shell do venore-slime; rail = arranjo do Aurora 0.1.13.
export type ThemeLayoutPreset = "topbar" | "rail";
export const THEME_LAYOUT_PRESETS: readonly ThemeLayoutPreset[] = ["topbar", "rail"];
export type ThemeMobileNavMode = "drawer" | "bottom-bar" | "fullscreen";
export const THEME_MOBILE_NAV_MODES: readonly ThemeMobileNavMode[] = ["drawer", "bottom-bar", "fullscreen"];
export type ContextualBarPlacement = "side" | "top" | "none";
export type PageWidth = "contained" | "wide" | "full";
export const PAGE_WIDTHS: readonly PageWidth[] = ["contained", "wide", "full"];
export const CANONICAL_SECTION_STYLES = ["default", "muted", "brand", "inverted", "accent"] as const;
export type SectionStyle = (typeof CANONICAL_SECTION_STYLES)[number];
