import { THEME_CONFIG_SETTING_KEY, type ThemeConfigDocument } from "../../../contracts/v8/config-document";

// Chaves 7.x que o read path sintetiza quando `theme.config` falta (get-published-theme-config) e
// que o código anterior à v8 lê direto — gravadas junto na publicação (dual-write, spec §4.1/§13)
// pra que um rollback de deploy continue mostrando o mesmo tema e as mesmas cores.
export const LEGACY_ACTIVE_THEME_KEY = "theme.active";
export const LEGACY_ACTIVE_PALETTE_KEY = "theme.activePaletteId";
export const LEGACY_CUSTOM_PALETTE_PREFIX = "theme.customColorPalette";
const LEGACY_DEFAULT_PALETTE_ID = "default";
// = CUSTOM_COLOR_PALETTE_ID (platform/theme-engine/custom-color-palette-id.ts); contexts não importa platform.
const LEGACY_CUSTOM_PALETTE_ID = "custom";

export type SettingEntry = { key: string; value: unknown };

// Valor gravado em `theme.config` = documento + metadado de publicação no topo (o read path tira
// os dois antes do parse .strict(), foundation-notes desvio 6).
export function publishedThemeConfigValue(document: ThemeConfigDocument, revisionId: string, publishedAt: string) {
  return { ...document, revisionId, publishedAt };
}

// `theme.config` primeiro (é o que o render lê), depois as chaves legadas na ordem que a síntese
// lê. Paleta "seed" vira a personalizada legada com as cores geradas — o 7.x não conhece seed.
export function buildPublishedSettingEntries(document: ThemeConfigDocument, revisionId: string, publishedAt: string): SettingEntry[] {
  const palette = document.byTheme[document.themeKey]?.palette ?? { mode: "default" as const };
  const entries: SettingEntry[] = [
    { key: THEME_CONFIG_SETTING_KEY, value: publishedThemeConfigValue(document, revisionId, publishedAt) },
    { key: LEGACY_ACTIVE_THEME_KEY, value: document.themeKey },
  ];
  switch (palette.mode) {
    case "default":
      entries.push({ key: LEGACY_ACTIVE_PALETTE_KEY, value: LEGACY_DEFAULT_PALETTE_ID });
      break;
    case "preset":
      entries.push({ key: LEGACY_ACTIVE_PALETTE_KEY, value: palette.presetId });
      break;
    case "custom":
      entries.push({ key: LEGACY_ACTIVE_PALETTE_KEY, value: LEGACY_CUSTOM_PALETTE_ID });
      entries.push({ key: `${LEGACY_CUSTOM_PALETTE_PREFIX}.${document.themeKey}`, value: { light: palette.light, dark: palette.dark } });
      break;
    case "seed":
      entries.push({ key: LEGACY_ACTIVE_PALETTE_KEY, value: LEGACY_CUSTOM_PALETTE_ID });
      entries.push({
        key: `${LEGACY_CUSTOM_PALETTE_PREFIX}.${document.themeKey}`,
        value: { light: palette.generated.light, dark: palette.generated.dark },
      });
      break;
  }
  return entries;
}
