"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/contexts/settings";
import { BRAND_SETTING_KEYS } from "@/platform/brand/get-brand-config";

export type BrandSettingsActionState = { error: string | null };

const returnTo = "/admin/settings/brand";

// Mesmo padrão de updateRegistrationApprovalAction (/admin/settings/actions.ts): erro do handler
// é devolvido de verdade via useActionState, nunca descartado silenciosamente. Cada chave é
// independente (contexts/settings não tem transação multi-chave), então para no primeiro erro.
// headerMode/position/size/scrolledSize saíram daqui (T2 — migraram pro tema ativo, ver
// ThemeManifest.brandAesthetics); comportamento do header saiu daqui pra /admin/themes (pedido
// desta sessão — junto das demais configurações do tema ativo); só sobra conteúdo (nome/logos/
// favicon/ícone do app/imagem de compartilhamento/descrição).
export async function updateBrandSettingsAction(
  _prevState: BrandSettingsActionState,
  formData: FormData,
): Promise<BrandSettingsActionState> {
  const entries: Array<{ key: string; value: unknown }> = [
    { key: BRAND_SETTING_KEYS.siteName, value: String(formData.get("siteName") ?? "") },
    { key: BRAND_SETTING_KEYS.logoMediaId, value: String(formData.get("logoMediaId") ?? "") },
    { key: BRAND_SETTING_KEYS.logoScrolledMediaId, value: String(formData.get("logoScrolledMediaId") ?? "") },
    { key: BRAND_SETTING_KEYS.faviconMediaId, value: String(formData.get("faviconMediaId") ?? "") },
    { key: BRAND_SETTING_KEYS.pwaIconMediaId, value: String(formData.get("pwaIconMediaId") ?? "") },
    { key: BRAND_SETTING_KEYS.ogImageMediaId, value: String(formData.get("ogImageMediaId") ?? "") },
    { key: BRAND_SETTING_KEYS.footerDescription, value: String(formData.get("footerDescription") ?? "") },
  ];

  for (const entry of entries) {
    const result = await setSetting(entry);
    if (!result.success) {
      return { error: result.error.message };
    }
  }

  revalidatePath(returnTo);
  return { error: null };
}
