import { beginOperation, endOperation } from "@/observability";
import { invalidateUserContext } from "../../../user-context-cache";
import { assertActorIsSuperadmin, SUPERADMIN_ROLE_KEY } from "../../../shared/privilege-guard";
import { findRoleById, findUserIdsWithRole, updateRoleName } from "./store";
import { toRoleRef } from "./view";
import type { RenameRoleCommand, RenameRoleResult } from "./types";

// Renomeia só o label de exibição (`name`) — `key` continua o identificador interno usado por
// checagens de autorização (ex: `role.key === "superadmin"`), sem mudar nada de authorization.
export async function renameRole(command: RenameRoleCommand): Promise<RenameRoleResult> {
  const handle = beginOperation({
    useCase: "rbac.role-management.rename-role",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  const role = await findRoleById(command.roleId);
  if (!role) {
    const error = { code: "rbac.roles.not_found", message: `Papel "${command.roleId}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  if (role.key === SUPERADMIN_ROLE_KEY) {
    const guard = await assertActorIsSuperadmin(command.actor.id, "Só um superadmin pode renomear o papel superadmin.");
    if (!guard.success) {
      endOperation(handle, guard);
      return guard;
    }
  }

  const updated = await updateRoleName(command.roleId, command.name);

  const affectedUserIds = await findUserIdsWithRole(command.roleId);
  await invalidateUserContext(affectedUserIds);

  endOperation(handle, {
    success: true,
    summary: `user:${command.actor.id} renomeou o papel "${role.key}" de "${role.name}" para "${command.name}".`,
    detail: { roleId: command.roleId, previousName: role.name, name: command.name },
  });

  return { success: true, data: toRoleRef(updated) };
}
