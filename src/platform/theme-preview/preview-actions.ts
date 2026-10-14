"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { discardThemeConfigDraft, publishThemeConfigDraft } from "@/platform/theme-engine/theme-config";
import { THEME_PREVIEW_COOKIE } from "./override-token";

// Ações da faixa de preview (spec §7.2: publicar, descartar, sair). Moram em platform porque a
// faixa é montada pelo (platform)/layout via platform/theme-rendering/preview-banner.tsx, que não
// importa app/. Autorização (settings.manage) acontece nos handlers do context, via composer.
export type PreviewBannerActionState = { error: string | null };

async function clearPreviewCookie(): Promise<void> {
  (await cookies()).delete(THEME_PREVIEW_COOKIE);
}

// Sair: só apaga o cookie deste navegador (nenhuma escrita, nenhum privilégio necessário).
export async function exitThemePreviewAction(): Promise<PreviewBannerActionState> {
  await clearPreviewCookie();
  revalidatePath("/", "layout");
  return { error: null };
}

export async function publishPreviewDraftAction(): Promise<PreviewBannerActionState> {
  const result = await publishThemeConfigDraft();
  if (!result.success) return { error: result.error.message };
  await clearPreviewCookie();
  revalidatePath("/", "layout");
  return { error: null };
}

export async function discardPreviewDraftAction(): Promise<PreviewBannerActionState> {
  const result = await discardThemeConfigDraft();
  if (!result.success) return { error: result.error.message };
  await clearPreviewCookie();
  revalidatePath("/", "layout");
  return { error: null };
}
