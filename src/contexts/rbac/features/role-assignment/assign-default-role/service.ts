import { beginOperation, endOperation } from "@/observability";
import { ensureBaseRbacDataSeeded } from "../../../ensure-base-rbac-data";
import { invalidateUserContext } from "../../../user-context-cache";
import { insertUserRole } from "../assign-role-to-user/store";
import { findRoleIdByKey } from "./store";
import type { GrantDefaultRoleInput, GrantDefaultRoleResult } from "./types";

// TODO: migrar para settings de plugin quando o manifesto existir (docs/venore-docks.md — Sistema de plugins).
export function defaultRegistrationRoleKey(): string {
  return process.env.RBAC_DEFAULT_REGISTRATION_ROLE_KEY ?? "member";
}

export async function grantDefaultRoleOnRegistration(command: GrantDefaultRoleInput): Promise<GrantDefaultRoleResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.assign-default-role",
    actor: { id: command.userId, type: "system" },
    kind: "write",
  });

  await ensureBaseRbacDataSeeded();
  const roleKey = defaultRegistrationRoleKey();
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
