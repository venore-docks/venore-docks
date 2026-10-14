import type { ComponentType } from "react";
import type { BreadcrumbItem, ColorPalette, ThemeManifest, ThemeShellProps } from "../types";
import type { ThemeBudgets } from "./budgets";
import type { PublishedThemeConfig, ThemeSectionOverride } from "./config-document";
import type { ThemeAssets, ThemeRegionOverrides, ThemeShellComponent } from "./definition";
import type { ThemeLayoutPreset, ThemeRegionKey } from "./enums";
import type { FontId, FontRole } from "./fonts";
import type { ThemeMessages, ThemeStrings } from "./i18n";
import type { ResolvedPageLayout, ThemeLayoutComponent } from "./layout";
import type {
  ThemeFontsDeclaration,
  ThemeLayoutDeclaration,
  ThemeManifestV8Fields,
  ThemePageBuilderDeclaration,
  ThemeResponsiveDeclaration,
} from "./manifest";
import type { ResolvedThemeOptions, ThemeOptionField } from "./options";
import type { ThemeOutletName, ThemeOutletNodes } from "./outlets";
import type { ThemeBlockRenderers } from "./page-builder";
import type { ThemePaletteRules } from "./palette";
import type { ContextualBarData } from "./regions";
import type { ThemeSeoDeclaration } from "./seo";
import type { ThemeServerStateKey, PageStateProps } from "./states";
import type { ThemeTemplates } from "./templates";

// Definição normalizada (spec §2.12): todo campo resolvido (kit como padrão). `legacyShell`
// não-nulo ⇒ tema 7.x, renderizado pelo adapter.
export type ResolvedThemeDefinition = {
  key: string;
  chain: readonly string[];
  contract: 7 | 8;
  manifest: ThemeManifest;
  legacyShell: ThemeShellComponent | null;
  layout: ThemeLayoutPreset | ThemeLayoutComponent;
  regions: Required<ThemeRegionOverrides>;
  replacedRegions: readonly ThemeRegionKey[];
  // Normalizado para mapas de variante com "default".
  templates: { [K in keyof Required<ThemeTemplates>]: Record<string, ComponentType<any>> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  states: Record<ThemeServerStateKey, ComponentType<PageStateProps>>;
  options: readonly ThemeOptionField[];
  responsive: Required<ThemeResponsiveDeclaration>;
  layoutDecl: Required<ThemeLayoutDeclaration>;
  fonts: Record<FontRole, FontId>;
  fontChoices: NonNullable<ThemeFontsDeclaration["choices"]>;
  messages: ThemeMessages;
  pageBuilder: Required<ThemePageBuilderDeclaration>;
  templateVariants: NonNullable<ThemeManifestV8Fields["templateVariants"]>;
  palette: ThemePaletteRules;
  seo: ThemeSeoDeclaration;
  budgets: ThemeBudgets;
  assets: ThemeAssets;
  blockRenderers: () => Promise<ThemeBlockRenderers>;
  colorPalettes: ColorPalette[];
  outletsRendered: readonly ThemeOutletName[];
};

// Overrides de render (spec §2.14) — só existem no render path, nunca no write path (§0.4).
export type RenderOverride =
  | { kind: "draft"; userId: string; revisionId: string; exp: number }
  | { kind: "gallery"; userId: string; themeKey: string; exp: number }
  | { kind: "safe-mode"; userId: string; exp: number };
export type ThemeFallbackReason = "missing-theme" | "disabled" | "out-of-range" | "invalid-chain" | "config-read-failed" | "forced";
export type ThemeRenderDiagnostics = {
  source: PublishedThemeConfig["source"] | "draft" | "safe-mode" | "forced-fallback";
  fallback: null | { reason: ThemeFallbackReason; requestedKey?: string };
  ignoredOptions: ResolvedThemeOptions["ignored"];
  section: string | null;
};
export type DocumentModel = {
  pathname: string | null;
  area: "public" | "admin";
  theme: ResolvedThemeDefinition;
  config: PublishedThemeConfig;
  section: ThemeSectionOverride | null;
  options: ResolvedThemeOptions;
  fonts: { classNames: string; css: string };
  locale: string;
  dir: "ltr" | "rtl";
  htmlAttributes: Record<string, string>;
  runtimeCss: string;
  override: RenderOverride | null;
  diagnostics: ThemeRenderDiagnostics;
};
// Props de slot 7.x que resolveThemeSlotProps devolve (header/footer/sidebarLeft).
export type ThemeShellProps7Base = Pick<ThemeShellProps, "header" | "footer" | "sidebarLeft">;
export type ThemeRenderModel = DocumentModel & {
  slotProps: ThemeShellProps7Base;
  // Trilha resolvida pelo core (o JSON-LD é renderizado pelo core, nunca pela região/Shell).
  breadcrumbs: BreadcrumbItem[];
  breadcrumbsJsonLd: Record<string, unknown> | null;
  contextual: ContextualBarData;
  outlets: ThemeOutletNodes;
  strings: ThemeStrings;
  page: ResolvedPageLayout;
  maintenance: boolean;
};
