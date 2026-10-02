import { getSetting } from "@/contexts/settings";
import {
  THEME_CONFIG_SETTING_KEY,
  emptyThemeConfigEntry,
  parseThemeConfigDocument,
  type PublishedThemeConfig,
  type ThemePaletteChoice,
} from "../../../contracts/v8/config-document";
import { readLastKnownGood, writeLastKnownGood } from "./store";
import type { GetPublishedThemeConfigResult } from "./types";

// Mesmas chaves que get-active-theme / get-active-color-palette / custom-color-palette lêem.
const LEGACY_ACTIVE_THEME_KEY = "theme.active";
const LEGACY_ACTIVE_PALETTE_KEY = "theme.activePaletteId";
const LEGACY_CUSTOM_PALETTE_PREFIX = "theme.customColorPalette";
// = CUSTOM_COLOR_PALETTE_ID (platform/theme-engine/custom-color-palette-id.ts); contexts não importa platform.
const LEGACY_CUSTOM_PALETTE_ID = "custom";
const FALLBACK_THEME_KEY = "venore-slime";

class SettingsReadError extends Error {}

async function readSettingValue(key: string): Promise<unknown> {
  const result = await getSetting({ key, skipCache: true });
  if (!result.success) throw new SettingsReadError(result.error.message);
  return result.data ? result.data.value : undefined;
}

function toColorRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

// Sem `theme.config` (ou valor inválido): monta o documento a partir das chaves 7.x — as mesmas
// leituras que o root layout fazia antes da v8, então o site renderiza igual.
async function synthesizeFromLegacyKeys(): Promise<PublishedThemeConfig> {
  const activeTheme = await readSettingValue(LEGACY_ACTIVE_THEME_KEY);
  const themeKey = typeof activeTheme === "string" ? activeTheme : FALLBACK_THEME_KEY;
  const paletteId = await readSettingValue(LEGACY_ACTIVE_PALETTE_KEY);

  let palette: ThemePaletteChoice = { mode: "default" };
  if (typeof paletteId === "string" && paletteId !== "default") {
    if (paletteId === LEGACY_CUSTOM_PALETTE_ID) {
      const stored = (await readSettingValue(`${LEGACY_CUSTOM_PALETTE_PREFIX}.${themeKey}`)) as
        | { light?: unknown; dark?: unknown }
        | undefined;
      palette = { mode: "custom", light: toColorRecord(stored?.light), dark: toColorRecord(stored?.dark) };
    } else {
      palette = { mode: "preset", presetId: paletteId };
    }
  }

  return {
    schemaVersion: 1,
    themeKey,
    byTheme: { [themeKey]: { ...emptyThemeConfigEntry(), palette } },
    assets: {},
    sections: [],
    revisionId: null,
    publishedAt: null,
    source: "legacy-synthesis",
  };
}

// Read path do render (spec §4.1): settings `theme.config` → síntese das chaves legadas →
// last-known-good do processo → falha (o chamador usa o padrão do slime). Nunca lê a tabela de
// revisões (invariante §0.6).
export async function getPublishedThemeConfig(): Promise<GetPublishedThemeConfigResult> {
  try {
    const stored = await readSettingValue(THEME_CONFIG_SETTING_KEY);
    // Valor gravado = ThemeConfigDocument + { revisionId, publishedAt } (metadado de publicação,
    // W6). Os dois saem antes do parse .strict() do documento.
    const { revisionId, publishedAt, ...documentValue } = (stored && typeof stored === "object" ? stored : {}) as {
      revisionId?: unknown;
      publishedAt?: unknown;
    };
    const document = stored === undefined ? null : parseThemeConfigDocument(documentValue);
    const config: PublishedThemeConfig = document
      ? {
          ...document,
          revisionId: typeof revisionId === "string" ? revisionId : null,
          publishedAt: typeof publishedAt === "string" ? publishedAt : null,
          source: "settings",
        }
      : await synthesizeFromLegacyKeys();
    writeLastKnownGood(config);
    return { success: true, data: config };
  } catch (error) {
    if (!(error instanceof SettingsReadError)) throw error;
    const lastKnownGood = readLastKnownGood();
    if (lastKnownGood) return { success: true, data: { ...lastKnownGood, source: "last-known-good" } };
    return { success: false, error: { code: "themes.config.read_failed", message: error.message } };
  }
}
