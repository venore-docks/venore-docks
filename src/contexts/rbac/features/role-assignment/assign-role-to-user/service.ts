import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { assertActorCanManageUserRoles, assertActorHoldsPermissions } from "../../../shared/privilege-guard";
import { invalidateUserContext } from "../../../user-context-cache";
import { findRoleWithPermissions, insertUserRole } from "./store";
import type { AssignRoleToUserCommand, AssignRoleToUserResult } from "./types";

export async function assignRoleToUser(command: AssignRoleToUserCommand): Promise<AssignRoleToUserResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.assign-role-to-user",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  const role = await findRoleWithPermissions(command.roleId);
  if (!role) {
    const error = { code: "rbac.roles.not_found", message: `Papel "${command.roleId}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  // Anti-escalonamento: superadmin (papel ou alvo) só por superadmin; e ninguém entrega, via
  // papel, uma permission que não tem (ver shared/privilege-guard.ts).
  const hierarchy = await assertActorCanManageUserRoles(command.actor.id, command.userId, role.key);
  if (!hierarchy.success) {
    endOperation(handle, hierarchy);
    return hierarchy;
  }
  const escalation = await assertActorHoldsPermissions(command.actor.id, role.permissionKeys);
  if (!escalation.success) {
    endOperation(handle, escalation);
    return escalation;
  }

  await insertUserRole(command.userId, command.roleId);
  invalidateUserContext(command.userId);

  const summary = `user:${command.actor.id} atribuiu o papel "${role.key}" ao usuário ${command.userId}.`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "rbac.assign-role",
    actor: { id: command.actor.id, type: "user" },
    outcome: "success",
    summary,
    detail: { userId: command.userId, roleId: command.roleId, roleKey: role.key },
  });

  return { success: true, data: undefined };
}
