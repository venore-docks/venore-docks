"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import { LOCALE_SETTING_KEY, TEXT_DIRECTION_SETTING_KEY } from "@/platform/theme-rendering/resolve-document-locale";
import { canonicalLocale, isTextDirectionSetting } from "@/shared/locale";

export type LocaleActionState = { error: string | null };

// Idioma e direção do site (settings platform.locale / platform.textDirection, spec v8 §4.1).
// settings.manage é checado aqui (antes de ler o formulário) e de novo por setSetting. O locale é
// guardado na forma canônica de Intl.getCanonicalLocales ("pt-br" → "pt-BR").
export async function updateLocaleAction(_prevState: LocaleActionState, formData: FormData): Promise<LocaleActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };

  const locale = canonicalLocale(formData.get("locale"));
  if (!locale) return { error: "Idioma inválido. Use um código BCP-47, como pt-BR, en, es ou ar." };
  const direction = formData.get("textDirection");
  if (!isTextDirectionSetting(direction)) return { error: "Direção do texto inválida." };

  for (const [key, value] of [
    [LOCALE_SETTING_KEY, locale],
    [TEXT_DIRECTION_SETTING_KEY, direction],
  ] as const) {
    const result = await setSetting({ key, value });
    if (!result.success) return { error: result.error.message };
  }

  // lang/dir do <html>, strings do tema, manifest e RSS de todo o site.
  revalidatePath("/", "layout");
  return { error: null };
}
