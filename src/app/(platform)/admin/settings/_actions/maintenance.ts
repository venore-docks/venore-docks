"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import { MAINTENANCE_MESSAGE_MAX_LENGTH, MAINTENANCE_SETTING_KEY } from "@/platform/theme-rendering/resolve-maintenance";

export type MaintenanceActionState = { error: string | null };

// Modo manutenção (setting platform.maintenance, spec v8 §4.1/§7.9). settings.manage é checado
// aqui (antes de ler o formulário) e de novo por setSetting.
export async function updateMaintenanceAction(_prevState: MaintenanceActionState, formData: FormData): Promise<MaintenanceActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };

  const message = String(formData.get("message") ?? "").trim();
  if (message.length > MAINTENANCE_MESSAGE_MAX_LENGTH) {
    return { error: `A mensagem pode ter no máximo ${MAINTENANCE_MESSAGE_MAX_LENGTH} caracteres.` };
  }

  const result = await setSetting({
    key: MAINTENANCE_SETTING_KEY,
    value: { enabled: formData.get("enabled") === "on", message },
  });
  if (!result.success) return { error: result.error.message };

  // O aviso substitui o conteúdo de todo o site público, não só desta tela.
  revalidatePath("/", "layout");
  return { error: null };
}
