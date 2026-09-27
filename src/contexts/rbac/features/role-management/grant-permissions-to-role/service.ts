import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { ensureBaseRbacDataSeeded } from "../../../ensure-base-rbac-data";
import { invalidateUserContext } from "../../../user-context-cache";
import { grantPermissionsToRoleByKey } from "./store";
import type { GrantPermissionsToRoleInput, GrantPermissionsToRoleResult } from "./types";

export async function grantPermissionsToRole(
  command: GrantPermissionsToRoleInput,
): Promise<GrantPermissionsToRoleResult> {
  const handle = beginOperation({
    useCase: "rbac.role-management.grant-permissions-to-role",
    actor: { id: "system", type: "system" },
    kind: "write",
  });

  // Self-heal do dado de bootstrap (roles + grants base), idempotente — mesmo motivo de
  // assign-default-role/service.ts chamar isto antes de resolver o papel.
  await ensureBaseRbacDataSeeded();

  const result = await grantPermissionsToRoleByKey(command.roleKey, command.permissionKeys);
  if (!result.roleFound) {
    const error = { code: "rbac.roles.not_found", message: `Papel "${command.roleKey}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  await invalidateUserContext(result.affectedUserIds);

  const summary = `Concedidas ${result.grantedCount} permission(s) nova(s) ao papel "${command.roleKey}" (${command.permissionKeys.length} solicitada(s)), afetando ${result.affectedUserIds.length} usuário(s).`;
  endOperation(handle, {
    success: true,
    summary,
    detail: { roleKey: command.roleKey, permissionKeys: command.permissionKeys, grantedCount: result.grantedCount },
  });

  await recordAuditEvent({
    action: "rbac.grant-permissions-to-role",
    actor: { id: "system", type: "system" },
    outcome: "success",
    summary,
    detail: {
      roleKey: command.roleKey,
      permissionKeys: command.permissionKeys,
      grantedCount: result.grantedCount,
      affectedUserCount: result.affectedUserIds.length,
    },
  });

  return { success: true, data: { grantedCount: result.grantedCount } };
}
