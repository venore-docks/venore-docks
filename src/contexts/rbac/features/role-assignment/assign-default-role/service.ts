import { beginOperation, endOperation } from "@/observability";
import { ensureBaseRbacDataSeeded } from "../../../ensure-base-rbac-data";
import { SUPERADMIN_ROLE_KEY } from "../../../shared/privilege-guard";
import { invalidateUserContext } from "../../../user-context-cache";
import { insertUserRole } from "../assign-role-to-user/store";
import { findRoleIdByKey } from "./store";
import type { OperationResult } from "@/shared/types";
import type { GrantDefaultRoleInput, GrantDefaultRoleResult } from "./types";

// Fallback quando quem chama não passa `roleKey` (a setting auth.registration_default_role mora em
// contexts/settings e é lida em platform/registration/registration-settings.ts — rbac não pode
// depender de settings, regra 12 do documento de arquitetura).
export function defaultRegistrationRoleKey(): string {
  return process.env.RBAC_DEFAULT_REGISTRATION_ROLE_KEY ?? "member";
}

// Nunca conceder superadmin como papel "padrão" de cadastro — mesmo que a setting ou a env var
// apontem pra ele (o bootstrap de superadmin é só /setup ou o instalador).
export function resolveDefaultRegistrationRoleKey(requested: string | undefined): OperationResult<string> {
  const roleKey = requested?.trim() || defaultRegistrationRoleKey();
  if (roleKey === SUPERADMIN_ROLE_KEY) {
    return {
      success: false,
      error: { code: "rbac.roles.default_role_forbidden", message: "O papel superadmin não pode ser o papel padrão de cadastro." },
    };
  }
  return { success: true, data: roleKey };
}

export async function grantDefaultRoleOnRegistration(command: GrantDefaultRoleInput): Promise<GrantDefaultRoleResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.assign-default-role",
    actor: { id: command.userId, type: "system" },
    kind: "write",
  });

  await ensureBaseRbacDataSeeded();
  const resolvedKey = resolveDefaultRegistrationRoleKey(command.roleKey);
  if (!resolvedKey.success) {
    endOperation(handle, { success: false, error: resolvedKey.error });
    return resolvedKey;
  }
  const roleKey = resolvedKey.data;
  const roleId = await findRoleIdByKey(roleKey);
  if (!roleId) {
    const error = { code: "rbac.roles.not_found", message: `Papel padrão "${roleKey}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  await insertUserRole(command.userId, roleId);
  await invalidateUserContext(command.userId);
  endOperation(handle, { success: true });
  return { success: true, data: undefined };
}
