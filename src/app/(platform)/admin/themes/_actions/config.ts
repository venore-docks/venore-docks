"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  discardThemeConfigDraft,
  importThemeConfigFile,
  issueDraftPreviewToken,
  publishThemeConfigDraft,
  rollbackThemeConfigRevision,
  saveThemeConfigDraft,
} from "@/platform/theme-engine/theme-config";
import { THEME_PREVIEW_COOKIE, themeOverrideCookieOptions } from "@/platform/theme-preview/override-token";

// Actions do ciclo de vida da config de aparência (spec §7.2/§7.10). Todas passam pelo composer
// de platform (validação contra o registro de temas) e, por ele, pelos handlers do context
// (settings.manage) — nenhuma grava nada antes da autorização. Mesmo padrão de erro devolvido
// via useActionState de admin/themes/actions.ts.
export type ConfigActionState = { error: string | null; warnings: string[]; done: boolean };

const THEMES_PATH = "/admin/themes";
const ok = (warnings: string[] = []): ConfigActionState => ({ error: null, warnings, done: true });
const fail = (message: string): ConfigActionState => ({ error: message, warnings: [], done: false });

function parseConfigField(formData: FormData): unknown {
  const raw = formData.get("config");
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setPreviewCookie(token: string): Promise<void> {
  (await cookies()).set(THEME_PREVIEW_COOKIE, token, themeOverrideCookieOptions());
}

// Salva o rascunho e (re)liga o preview dele para este admin — o iframe do Personalizar
// recarrega em seguida e já renderiza o rascunho.
export async function saveThemeDraftAction(_prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const basedOn = formData.get("basedOnRevisionId");
  const result = await saveThemeConfigDraft({
    config: parseConfigField(formData),
    basedOnRevisionId: typeof basedOn === "string" && basedOn.length > 0 ? basedOn : undefined,
  });
  if (!result.success) return fail(result.error.message);

  const preview = await issueDraftPreviewToken();
  if (preview.success) await setPreviewCookie(preview.data.token);
  revalidatePath(THEMES_PATH, "layout");
  return ok(result.data.warnings);
}

export async function startThemePreviewAction(): Promise<ConfigActionState> {
  const preview = await issueDraftPreviewToken();
  if (!preview.success) return fail(preview.error.message);
  await setPreviewCookie(preview.data.token);
  return ok();
}

export async function stopThemePreviewAction(): Promise<ConfigActionState> {
  (await cookies()).delete(THEME_PREVIEW_COOKIE);
  return ok();
}

export async function discardThemeDraftAction(): Promise<ConfigActionState> {
  const result = await discardThemeConfigDraft();
  if (!result.success) return fail(result.error.message);
  (await cookies()).delete(THEME_PREVIEW_COOKIE);
  revalidatePath(THEMES_PATH, "layout");
  return ok();
}

export async function publishThemeDraftAction(): Promise<ConfigActionState> {
  const result = await publishThemeConfigDraft();
  if (!result.success) return fail(result.error.message);
  (await cookies()).delete(THEME_PREVIEW_COOKIE);
  // Tema/paleta valem pra toda rota (root layout) — mesmo motivo de revalidateEverywhere em actions.ts.
  revalidatePath("/", "layout");
  return ok(result.data.warnings);
}

export async function rollbackThemeConfigAction(_prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const revisionId = String(formData.get("revisionId") ?? "");
  const result = await rollbackThemeConfigRevision(revisionId);
  if (!result.success) return fail(result.error.message);
  revalidatePath("/", "layout");
  return ok();
}

// Importa um arquivo exportado como RASCUNHO (spec §7.10) — nada é publicado.
export async function importThemeConfigAction(_prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const result = await importThemeConfigFile(formData.get("file"));
  if (!result.success) return fail(result.error.message);
  revalidatePath(THEMES_PATH, "layout");
  return ok(result.data.warnings);
}
