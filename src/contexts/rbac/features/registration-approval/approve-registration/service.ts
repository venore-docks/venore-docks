import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { approveUserRegistration } from "@/contexts/auth";
import { assignRoleToUser } from "../../role-assignment/assign-role-to-user/service";
import { findRoleIdByKey } from "../../role-assignment/assign-default-role/store";
import { resolveDefaultRegistrationRoleKey } from "../../role-assignment/assign-default-role/service";
import type { ApproveRegistrationCommand, ApproveRegistrationResult } from "./types";

export async function approveRegistration(command: ApproveRegistrationCommand): Promise<ApproveRegistrationResult> {
  const handle = beginOperation({
    useCase: "rbac.registration-approval.approve-registration",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  // Papel resolvido ANTES de aprovar: papel padrão inexistente/proibido não pode deixar a conta
  // aprovada sem papel nenhum.
  let roleId = command.roleId;
  if (!roleId) {
    const resolvedKey = resolveDefaultRegistrationRoleKey(command.roleKey);
    if (!resolvedKey.success) {
      endOperation(handle, { success: false, error: resolvedKey.error });
      return resolvedKey;
    }
    const roleKey = resolvedKey.data;
    const defaultRoleId = await findRoleIdByKey(roleKey);
    if (!defaultRoleId) {
      const error = { code: "rbac.roles.not_found", message: `Papel padrão "${roleKey}" não encontrado.` };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
    roleId = defaultRoleId;
  }

  const approval = await approveUserRegistration({ userId: command.userId });
  if (!approval.success) {
    endOperation(handle, { success: false, error: approval.error });
    return approval;
  }

  const assignment = await assignRoleToUser({ userId: command.userId, roleId, actor: command.actor });
  if (!assignment.success) {
    endOperation(handle, { success: false, error: assignment.error });
    return assignment;
  }

  const summary = `user:${command.actor.id} aprovou o registro do usuário ${command.userId}.`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "rbac.approve-registration",
    actor: { id: command.actor.id, type: "user" as const },
    outcome: "success",
    summary,
    detail: { userId: command.userId, roleId },
  });

  return { success: true, data: undefined };
}
