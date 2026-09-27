"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/contexts/settings";
import {
  REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY,
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
