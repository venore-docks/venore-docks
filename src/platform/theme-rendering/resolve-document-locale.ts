import { cache } from "react";
import { CORE_SETTING_DEFAULTS, getSetting } from "@/contexts/settings";
import { parseDocumentLocale, type TextDirection } from "@/shared/locale";

export const LOCALE_SETTING_KEY = "platform.locale";
export const TEXT_DIRECTION_SETTING_KEY = "platform.textDirection";

async function readSettingValue(key: typeof LOCALE_SETTING_KEY | typeof TEXT_DIRECTION_SETTING_KEY): Promise<unknown> {
  const result = await getSetting({ key });
  return result.success && result.data ? result.data.value : CORE_SETTING_DEFAULTS[key];
}

// Locale e direção do documento (spec §4.1/§7.11): <html lang dir>, web manifest e RSS
// <language>. `auto` deriva a direção do idioma (ar he fa ur → rtl). Erro de leitura ou valor
// inválido = pt-BR/ltr, o site de antes da v8. Uma leitura por request.
export const resolveDocumentLocale = cache(async (): Promise<{ locale: string; dir: TextDirection }> => {
  try {
    const [locale, direction] = await Promise.all([readSettingValue(LOCALE_SETTING_KEY), readSettingValue(TEXT_DIRECTION_SETTING_KEY)]);
    return parseDocumentLocale(locale, direction);
  } catch {
    return parseDocumentLocale(undefined, undefined);
  }
});
