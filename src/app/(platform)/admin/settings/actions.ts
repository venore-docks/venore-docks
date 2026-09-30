"use server";

import { revalidatePath } from "next/cache";
import { authorizeActor, checkActorCanGrantRole } from "@/contexts/rbac";
import { setSetting } from "@/contexts/settings";
import {
  REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY,
  REGISTRATION_DEFAULT_ROLE_SETTING_KEY,
  SELF_REGISTRATION_ENABLED_SETTING_KEY,
} from "@/platform/registration/registration-settings";

export type SettingsActionState = { error: string | null };

// Mesmo padrão de removeRoleAction (/admin/rbac/actions.ts): erro do handler é devolvido de
// verdade via useActionState, nunca descartado silenciosamente (docs/venore-docks.md).
export async function updateRegistrationApprovalAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const entries = [
    { key: REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY, value: formData.get("enabled") === "on" },
    { key: SELF_REGISTRATION_ENABLED_SETTING_KEY, value: formData.get("selfRegistration") === "on" },
  ];

  for (const entry of entries) {
    const result = await setSetting(entry);
    if (!result.success) {
      return { error: result.error.message };
    }
  }

  revalidatePath("/admin/settings");
  return { error: null };
}

// Papel padrão de novas contas. Além de settings.manage (checado de novo por setSetting), quem
// escolhe precisa poder conceder aquele papel (mesma trava de privilégio de convites e de
// /admin/rbac): senão um admin com settings.manage faria todo cadastro novo nascer com
// permissões que ele mesmo não tem. superadmin é sempre recusado.
export async function updateDefaultRegistrationRoleAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const authz = await authorizeActor("settings.manage");
  if (!authz.authorized) return { error: authz.error.message };

  const roleId = String(formData.get("roleId") ?? "").trim();
  let roleKey = "";
  if (roleId.length > 0) {
    const grantable = await checkActorCanGrantRole(authz.actorId, roleId);
    if (!grantable.success) return { error: grantable.error.message };
    if (grantable.data.key === "superadmin") {
      return { error: "O papel superadmin não pode ser o papel padrão de cadastro." };
    }
    roleKey = grantable.data.key;
  }

  const result = await setSetting({ key: REGISTRATION_DEFAULT_ROLE_SETTING_KEY, value: roleKey });
  if (!result.success) return { error: result.error.message };

  revalidatePath("/admin/settings");
  return { error: null };
}
