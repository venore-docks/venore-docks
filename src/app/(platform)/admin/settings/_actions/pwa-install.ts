"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import { PWA_INSTALL_SETTING_KEY, PWA_MAX_COOLDOWN_DAYS } from "@/platform/pwa/install-policy";

export type PwaInstallActionState = { error: string | null };

// Convite de instalação do PWA (setting platform.pwa_install). settings.manage é checado aqui e por setSetting.
export async function updatePwaInstallAction(_prev: PwaInstallActionState, formData: FormData): Promise<PwaInstallActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };

  const cooldownDays = Number(formData.get("cooldownDays"));
  if (!Number.isInteger(cooldownDays) || cooldownDays < 0 || cooldownDays > PWA_MAX_COOLDOWN_DAYS) {
    return { error: `Dias de espera deve ser um inteiro de 0 a ${PWA_MAX_COOLDOWN_DAYS}.` };
  }
  const result = await setSetting({
    key: PWA_INSTALL_SETTING_KEY,
    value: {
      enabled: formData.get("enabled") === "on",
      cooldownDays,
      mobile: formData.get("mobile") === "on",
      desktop: formData.get("desktop") === "on",
    },
  });
  if (!result.success) return { error: result.error.message };
  revalidatePath("/", "layout");
  return { error: null };
}
