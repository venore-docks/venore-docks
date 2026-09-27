import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { assertActorCanManageUserRoles } from "../../../shared/privilege-guard";
import { invalidateUserContext } from "../../../user-context-cache";
import { deleteUserRole, findRoleById, findUserIdsWithRole } from "./store";
import type { RemoveRoleFromUserCommand, RemoveRoleFromUserResult } from "./types";

export async function removeRoleFromUser(command: RemoveRoleFromUserCommand): Promise<RemoveRoleFromUserResult> {
  const handle = beginOperation({
    useCase: "rbac.role-assignment.remove-role-from-user",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  const role = await findRoleById(command.roleId);
  if (role) {
    const hierarchy = await assertActorCanManageUserRoles(command.actor.id, command.userId, role.key);
    if (!hierarchy.success) {
      endOperation(handle, hierarchy);
      return hierarchy;
    }
  }
  if (role?.key === "superadmin") {
    // docs/venore-docks.md — Modelo de RBAC: recusa remover superadmin de um usuário se isso
    // deixar o sistema com zero superadmin, mesmo o próprio superadmin removendo a si mesmo —
    // sem essa checagem reabre o deadlock que o bootstrap de superadmin resolve.
    const userIds = await findUserIdsWithRole(command.roleId);
    const isLastSuperadmin = userIds.length === 1 && userIds[0] === command.userId;
    if (isLastSuperadmin) {
      const error = {
        code: "rbac.roles.cannot_remove_last_superadmin",
        message: "Não é possível remover o papel superadmin do último usuário que o possui — o sistema ficaria sem nenhum superadmin.",
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  }

  await deleteUserRole(command.userId, command.roleId);
  invalidateUserContext(command.userId);

  const summary = `user:${command.actor.id} removeu o papel "${role?.key ?? command.roleId}" do usuário ${command.userId}.`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "rbac.remove-role",
    actor: { id: command.actor.id, type: "user" },
    outcome: "success",
    summary,
    detail: { userId: command.userId, roleId: command.roleId, roleKey: role?.key ?? null },
  });

  return { success: true, data: undefined };
}
