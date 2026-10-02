import { z } from "zod";
import { FONT_IDS, type FontId, type FontRole } from "./fonts";
import { PAGE_WIDTHS, THEME_LAYOUT_PRESETS, THEME_MOBILE_NAV_MODES, THEME_TEMPLATE_KEYS } from "./enums";
import type { ThemeLayoutPreset, ThemeMobileNavMode, ThemeTemplateKey } from "./enums";
import type { ResolvedPageLayout } from "./layout";
import type { ThemeOptionValue } from "./options";

// Documento de configuração do tema (spec §2.13). A versão PUBLICADA vive no settings key
// `theme.config` (o render path nunca lê a tabela de revisões — invariante §0.6). Rascunho e
// histórico ficam em themes.theme_config_revisions.
export const THEME_CONFIG_SETTING_KEY = "theme.config";
export const THEME_CONFIG_HISTORY_LIMIT = 20;
export const THEME_CONFIG_MAX_SECTIONS = 30;

export type ThemePaletteChoice =
  | { mode: "default" }
  | { mode: "preset"; presetId: string }
  | { mode: "seed"; seed: string; generated: { light: Record<string, string>; dark: Record<string, string> } }
  | { mode: "custom"; light: Record<string, string>; dark: Record<string, string> };
export type ThemeConfigByTheme = {
  palette: ThemePaletteChoice;
  options: Record<string, ThemeOptionValue>;
  fonts: Partial<Record<FontRole, FontId>>;
};
export type ThemeSectionOverride = {
  id: string;
  label: string;
  pathPrefix: string; // normalizePathPrefix; não "/", nem /admin*, /ext*, /api*, /login*
  themeKey?: string;
  layoutPreset?: ThemeLayoutPreset;
  mobileNav?: ThemeMobileNavMode;
  page?: Partial<Omit<ResolvedPageLayout, "template">>;
  templates?: Partial<Record<ThemeTemplateKey, string>>;
  palette?: ThemePaletteChoice;
  options?: Record<string, ThemeOptionValue>;
};
export type ThemeConfigDocument = {
  schemaVersion: 1;
  themeKey: string;
  byTheme: Record<string, ThemeConfigByTheme>; // por theme key ⇒ nada vaza na troca de tema
  assets: { ogImageMediaId?: string; iconMediaId?: string };
  sections: ThemeSectionOverride[];
};
export type PublishedThemeConfig = ThemeConfigDocument & {
  revisionId: string | null;
  publishedAt: string | null;
  source: "settings" | "legacy-synthesis" | "last-known-good";
};
export type ThemeConfigExportEnvelope = {
  format: "venore-theme-config";
  formatVersion: 1;
  exportedAt: string;
  coreContract: string;
  theme: { key: string; version: string };
  config: ThemeConfigDocument;
};

// ── zod (.strict()) ────────────────────────────────────────────────────────────────────────
// Cor: hex #rgb/#rrggbb ou oklch estrito `oklch(L C H)` / `oklch(L C H / A)` com números.
export const THEME_COLOR_VALUE_PATTERN =
  /^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|oklch\(\s*(?:0|1|0?\.\d+|\d{1,3}(?:\.\d+)?%)\s+\d*\.?\d+\s+\d*\.?\d+(?:\s*\/\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\))$/i;
const themeKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const colorMapSchema = z.record(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), z.string().regex(THEME_COLOR_VALUE_PATTERN));
const optionValueSchema = z.union([z.string().max(2048), z.number(), z.boolean(), z.null()]);

export const themePaletteChoiceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("default") }).strict(),
  z.object({ mode: z.literal("preset"), presetId: z.string().min(1).max(128) }).strict(),
  z
    .object({
      mode: z.literal("seed"),
      seed: z.string().regex(THEME_COLOR_VALUE_PATTERN),
      generated: z.object({ light: colorMapSchema, dark: colorMapSchema }).strict(),
    })
    .strict(),
  z.object({ mode: z.literal("custom"), light: colorMapSchema, dark: colorMapSchema }).strict(),
]);

const fontRoleMap = z
  .object({ sans: z.enum(FONT_IDS).optional(), display: z.enum(FONT_IDS).optional(), mono: z.enum(FONT_IDS).optional() })
  .strict();

export const themeConfigByThemeSchema = z
  .object({
    palette: themePaletteChoiceSchema,
    options: z.record(z.string().max(64), optionValueSchema),
    fonts: fontRoleMap,
  })
  .strict();

export const themeSectionOverrideSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    pathPrefix: z.string().min(2).max(512),
    themeKey: themeKeySchema.optional(),
    layoutPreset: z.enum(THEME_LAYOUT_PRESETS as [ThemeLayoutPreset, ...ThemeLayoutPreset[]]).optional(),
    mobileNav: z.enum(THEME_MOBILE_NAV_MODES as [ThemeMobileNavMode, ...ThemeMobileNavMode[]]).optional(),
    page: z
      .object({
        width: z.enum(PAGE_WIDTHS as [string, ...string[]]).optional(),
        showRail: z.boolean().optional(),
        contextualPlacement: z.enum(["side", "top", "none"]).optional(),
      })
      .strict()
      .optional(),
    templates: z
      .partialRecord(z.enum(THEME_TEMPLATE_KEYS as [ThemeTemplateKey, ...ThemeTemplateKey[]]), z.string().min(1).max(64))
      .optional(),
    palette: themePaletteChoiceSchema.optional(),
    options: z.record(z.string().max(64), optionValueSchema).optional(),
  })
  .strict();

export const themeConfigDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    themeKey: themeKeySchema,
    byTheme: z.record(themeKeySchema, themeConfigByThemeSchema),
    assets: z.object({ ogImageMediaId: z.string().max(64).optional(), iconMediaId: z.string().max(64).optional() }).strict(),
    sections: z.array(themeSectionOverrideSchema).max(THEME_CONFIG_MAX_SECTIONS),
  })
  .strict();

export const themeConfigExportEnvelopeSchema = z
  .object({
    format: z.literal("venore-theme-config"),
    formatVersion: z.literal(1),
    exportedAt: z.string(),
    coreContract: z.string(),
    theme: z.object({ key: themeKeySchema, version: z.string() }).strict(),
    config: themeConfigDocumentSchema,
  })
  .strict();

// Valida um valor desconhecido (ex: lido do settings). Inválido ⇒ null (tratado como ausente).
export function parseThemeConfigDocument(value: unknown): ThemeConfigDocument | null {
  const parsed = themeConfigDocumentSchema.safeParse(value);
  return parsed.success ? (parsed.data as ThemeConfigDocument) : null;
}

export function emptyThemeConfigEntry(): ThemeConfigByTheme {
  return { palette: { mode: "default" }, options: {}, fonts: {} };
}

// Revisão (rascunho/publicada/arquivada) como o admin vê (spec §4.2). Datas em ISO.
export type ThemeConfigRevisionStatus = "draft" | "published" | "archived";
export type ThemeConfigRevisionView = {
  id: string;
  status: ThemeConfigRevisionStatus;
  config: ThemeConfigDocument;
  basedOnRevisionId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
};

// Documento padrão (slime, sem paleta/opções) — último degrau do fallback de leitura.
export function defaultThemeConfigDocument(themeKey = "venore-slime"): ThemeConfigDocument {
  return { schemaVersion: 1, themeKey, byTheme: { [themeKey]: emptyThemeConfigEntry() }, assets: {}, sections: [] };
}
