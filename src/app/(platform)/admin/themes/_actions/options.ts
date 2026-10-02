"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import type { ThemeConfigDocument, ThemeOptionValue } from "@/contexts/themes/contracts/v8";
import { loadThemeCustomizeData, saveThemeConfigDraft } from "@/platform/theme-engine/theme-config";
import { isReservedThemeOptionKey, parseThemeOptionsFormData } from "@/platform/theme-engine/theme-options";

export type OptionsActionState = { error: string | null; fieldErrors: Record<string, string>; warnings: string[]; done: boolean };

const fail = (error: string, fieldErrors: Record<string, string> = {}): OptionsActionState => ({ error, fieldErrors, warnings: [], done: false });

// Opções do tema (spec v8 §2.3/§9, W2): grava os valores no RASCUNHO (byTheme[tema].options),
// nunca direto no publicado. Autoriza settings.manage antes de ler qualquer coisa; o resto
// (validação contra o registro, saveThemeDraft do context) passa pelo composer de W6.
export async function saveThemeOptionsAction(_prev: OptionsActionState, formData: FormData): Promise<OptionsActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return fail(authz.error.message);

  const loaded = await loadThemeCustomizeData();
  if (!loaded.success) return fail(loaded.error.message);
  const { document, draft, theme } = loaded.data;
  if (formData.get("themeKey") !== theme.key) return fail("O tema mudou desde que a página abriu — recarregue e tente de novo.");

  const parsed = parseThemeOptionsFormData(theme.options, formData);
  if (!parsed.success) return fail("Alguns valores são inválidos.", parsed.fieldErrors);

  const current = document.byTheme[theme.key];
  // Chaves reservadas (layout/mobile-nav, gravadas pelo ThemePanel) são preservadas.
  const reserved: Record<string, ThemeOptionValue> = Object.fromEntries(
    Object.entries(current?.options ?? {}).filter(([key]) => isReservedThemeOptionKey(key)),
  );
  const config: ThemeConfigDocument = {
    ...document,
    byTheme: {
      ...document.byTheme,
      [theme.key]: { palette: current?.palette ?? { mode: "default" }, fonts: current?.fonts ?? {}, options: { ...reserved, ...parsed.values } },
    },
  };

  const saved = await saveThemeConfigDraft({ config, basedOnRevisionId: draft?.id ?? null });
  if (!saved.success) return fail(saved.error.message);
  revalidatePath("/admin/themes", "layout");
  return { error: null, fieldErrors: {}, warnings: saved.data.warnings, done: true };
}

