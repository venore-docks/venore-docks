"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import { MEMBERS_ONLY_SETTING_KEY, normalizeOpenPath } from "@/platform/site-access/members-only";

export type MembersOnlyActionState = { error: string | null };

// Site só para logados (setting platform.members_only). settings.manage é checado antes de ler o
// formulário e de novo por setSetting.
export async function updateMembersOnlyAction(_prevState: MembersOnlyActionState, formData: FormData): Promise<MembersOnlyActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };

  const lines = String(formData.get("openPaths") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const openPaths: string[] = [];
  for (const line of lines) {
    const normalized = normalizeOpenPath(line);
    if (!normalized) return { error: `Caminho inválido: "${line}". Use algo como /calendarios.` };
    openPaths.push(normalized);
  }
  if (openPaths.length > 50) return { error: "No máximo 50 caminhos abertos." };

  const result = await setSetting({
    key: MEMBERS_ONLY_SETTING_KEY,
    value: { enabled: formData.get("enabled") === "on", openPaths },
  });
  if (!result.success) return { error: result.error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
