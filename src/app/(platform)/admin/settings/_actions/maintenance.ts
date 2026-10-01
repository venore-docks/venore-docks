"use server";

import { authorizeActor } from "@/contexts/rbac";

export type MaintenanceActionState = { error: string | null };

// Modo manutenção (settings platform.maintenance, spec v8 §7.9). Dono: W4 — stub da Fase F:
// autoriza (settings.manage) e não grava nada.
export async function updateMaintenanceAction(_prevState: MaintenanceActionState, formData: FormData): Promise<MaintenanceActionState> {
  void formData;
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };
  return { error: "Modo manutenção ainda não disponível." };
}
