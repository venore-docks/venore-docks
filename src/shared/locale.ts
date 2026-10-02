// Locale/direção do site (settings platform.locale / platform.textDirection, spec v8 §4.1). Puro —
// usado pela leitura de render (platform), pela action do admin e por testes.
export type TextDirection = "ltr" | "rtl";
export type TextDirectionSetting = "auto" | TextDirection;

export const DEFAULT_SITE_LOCALE = "pt-BR";
export const TEXT_DIRECTION_SETTINGS: readonly TextDirectionSetting[] = ["auto", "ltr", "rtl"];
// Idiomas escritos da direita para a esquerda que o `auto` reconhece.
export const RTL_LANGUAGES: readonly string[] = ["ar", "he", "fa", "ur"];

// BCP-47 canônico ("pt-br" → "pt-BR") ou null quando inválido. Um só locale; vazio é inválido.
export function canonicalLocale(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 35) return null;
  try {
    const [canonical] = Intl.getCanonicalLocales(trimmed);
    return canonical ?? null;
  } catch {
    return null;
  }
}

export function isTextDirectionSetting(value: unknown): value is TextDirectionSetting {
  return typeof value === "string" && (TEXT_DIRECTION_SETTINGS as readonly string[]).includes(value);
}

export function directionForLocale(locale: string, setting: TextDirectionSetting = "auto"): TextDirection {
  if (setting !== "auto") return setting;
  const language = locale.split("-")[0]?.toLowerCase() ?? "";
  return RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
}

// Valores salvos → locale/direção do documento. Valor inválido conta como o padrão.
export function parseDocumentLocale(localeValue: unknown, directionValue: unknown): { locale: string; dir: TextDirection } {
  const locale = canonicalLocale(localeValue) ?? DEFAULT_SITE_LOCALE;
  const setting = isTextDirectionSetting(directionValue) ? directionValue : "auto";
  return { locale, dir: directionForLocale(locale, setting) };
}
