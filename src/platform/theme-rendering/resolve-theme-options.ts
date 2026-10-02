import type { ResolvedThemeDefinition, ResolvedThemeOptions, ThemeOptionField, ThemeOptionValue } from "@/contexts/themes/contracts/v8";
import {
  isReservedThemeOptionKey,
  isValidOptionValue,
  isValidReservedOptionValue,
  THEME_OPTION_MEDIA_ID_PATTERN,
  themeOptionDefault,
} from "@/platform/theme-engine/theme-options";

type Ignored = ResolvedThemeOptions["ignored"][number];
type StoredOptions = Readonly<Record<string, ThemeOptionValue>> | undefined;

// URL da mídia escolhida numa opção `media`: o asset é servido por /api/media/asset/[id] (que
// autoriza mídia não pública). O render é síncrono e não lê o banco, então `alt` fica vazio.
function mediaUrl(id: string): string {
  return `/api/media/asset/${encodeURIComponent(id)}`;
}

// Valores efetivos das opções do tema (spec §6 passo 8): padrão do manifesto ← valor salvo do
// tema ← override da seção. Valor salvo que não passa no validador do campo (zod, theme-options)
// é ignorado — vale o padrão — e listado em `ignored` (diagnóstico): `unknown` = chave não
// declarada, `removed` = chave que o tema removeu (removeOptions), `invalid` = tipo/faixa/escolha.
export function resolveThemeOptions(theme: ResolvedThemeDefinition, stored: StoredOptions, sectionOverrides: StoredOptions): ResolvedThemeOptions {
  const fields = new Map<string, ThemeOptionField>(theme.options.map((field) => [field.key, field]));
  const removed = new Set(theme.manifest.removeOptions ?? []);
  const values: Record<string, ThemeOptionValue> = Object.fromEntries(theme.options.map((field) => [field.key, themeOptionDefault(field)]));
  const ignored: Ignored[] = [];
  const ignore = (entry: Ignored) => {
    if (!ignored.some((existing) => existing.key === entry.key && existing.reason === entry.reason)) ignored.push(entry);
  };

  for (const layer of [stored, sectionOverrides]) {
    if (!layer || typeof layer !== "object") continue;
    for (const [key, value] of Object.entries(layer)) {
      if (isReservedThemeOptionKey(key)) {
        if (value === null) continue;
        if (isValidReservedOptionValue(theme, key, value)) values[key] = value;
        else ignore({ key, reason: "invalid" });
        continue;
      }
      const field = fields.get(key);
      if (!field) {
        ignore({ key, reason: removed.has(key) ? "removed" : "unknown" });
        continue;
      }
      if (value === null) continue; // null = "padrão do tema"
      if (!isValidOptionValue(field, value)) {
        ignore({ key, reason: "invalid" });
        continue;
      }
      values[key] = value;
    }
  }

  const media: Record<string, { url: string; alt: string } | null> = {};
  for (const field of theme.options) {
    if (field.type !== "media") continue;
    const id = values[field.key];
    media[field.key] = typeof id === "string" && THEME_OPTION_MEDIA_ID_PATTERN.test(id) ? { url: mediaUrl(id), alt: "" } : null;
  }

  return { values, media, ignored };
}
