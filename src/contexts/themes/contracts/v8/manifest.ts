import type { FontId, FontRole } from "./fonts";
import type { ThemeLayoutPreset, ThemeMobileNavMode, ThemeTemplateKey, SectionStyle } from "./enums";
import type { ThemeText } from "./i18n";
import type { ThemeOptionField } from "./options";
import type { ThemePaletteRules } from "./palette";
import type { ThemeOutletName } from "./outlets";
import type { ThemeSeoDeclaration } from "./seo";
import type { ThemeBudgets } from "./budgets";

// Campos de manifesto da v8 (spec §2.2). Todos opcionais: `ThemeManifest` (contracts/types.ts) é
// `ThemeManifest7 & ThemeManifestV8Fields`, então um manifesto 7.x continua válido sem mudança.
export type ThemeLayoutDeclaration = {
  preset?: ThemeLayoutPreset | "custom";
  presetChoices?: readonly ThemeLayoutPreset[];
  railSide?: "start" | "end";
  collapseControl?: "rail" | "header" | "none";
  headerNavVisibleFrom?: "always" | "md" | "lg";
};
export type ThemeResponsiveDeclaration = {
  mobileNav?: ThemeMobileNavMode;
  mobileNavChoices?: readonly ThemeMobileNavMode[];
  contextualBarMobile?: "top-collapsible" | "bottom" | "hidden";
};
export type ThemePageBuilderDeclaration = {
  blockVariants?: Record<string, readonly { value: string; label: ThemeText }[]>;
  sectionStyles?: readonly { value: string; label: ThemeText }[];
  hideSectionStyles?: readonly SectionStyle[];
};
export type ThemeFontsDeclaration = Partial<Record<FontRole, FontId>> & {
  choices?: Partial<Record<FontRole, readonly FontId[]>>;
};

export interface ThemeManifestV8Fields {
  // Chave do tema pai. Profundidade ≤ 3; pai v8 (ou v7 se o filho não declara layout/regions).
  extends?: string;
  layout?: ThemeLayoutDeclaration;
  responsive?: ThemeResponsiveDeclaration;
  options?: readonly ThemeOptionField[];
  removeOptions?: readonly string[];
  palette?: ThemePaletteRules;
  fonts?: ThemeFontsDeclaration;
  pageBuilder?: ThemePageBuilderDeclaration;
  templateVariants?: Partial<Record<ThemeTemplateKey, readonly { value: string; label: ThemeText }[]>>;
  // Outlets renderizados pelas regiões custom do tema (regiões do kit renderizam todos).
  outlets?: readonly ThemeOutletName[];
  seo?: ThemeSeoDeclaration;
  locales?: readonly string[];
  budgets?: Partial<ThemeBudgets>;
}

// Metadado que um pacote v8 declara no package.json (`"venoreTheme"`): o codegen lê isto em vez
// de importar TS (o manifest.ts continua sendo a fonte de runtime; registry.test confere os dois).
export type VenoreThemePackageField = {
  contract: string;
  key: string;
  extends?: string;
  assets?: Record<string, string>;
  messages?: Record<string, string>;
};
