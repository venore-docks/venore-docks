"use server";

import { authorizeActor } from "@/contexts/rbac";

export type LocaleActionState = { error: string | null };

// Idioma e direção do site (settings platform.locale / platform.textDirection, spec v8 §4.1).
// Dono: W8 — stub da Fase F: autoriza (settings.manage) e não grava nada.
export async function updateLocaleAction(_prevState: LocaleActionState, formData: FormData): Promise<LocaleActionState> {
  void formData;
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };
  return { error: "Configuração de idioma ainda não disponível." };
}
