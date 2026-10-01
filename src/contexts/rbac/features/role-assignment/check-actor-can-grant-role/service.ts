import type { OperationResult } from "@/shared/types";
import { assertActorHoldsPermissions, assertActorIsSuperadmin, SUPERADMIN_ROLE_KEY } from "../../../shared/privilege-guard";
import { findRoleWithPermissions } from "../assign-role-to-user/store";

export type GrantableRole = { id: string; key: string; name: string };

// Mesmas travas de assignRoleToUser, sem usuário-alvo (ainda não existe — convite): superadmin só
// por superadmin, e ninguém entrega permission que não tem.
export async function checkActorCanGrantRole(actorId: string, roleId: string): Promise<OperationResult<GrantableRole>> {
  const role = await findRoleWithPermissions(roleId);
  if (!role) return { success: false, error: { code: "rbac.roles.not_found", message: "Papel não encontrado." } };
  if (role.key === SUPERADMIN_ROLE_KEY) {
    const superadmin = await assertActorIsSuperadmin(actorId, "Só superadmin convida para o papel superadmin.");
    if (!superadmin.success) return superadmin;
  }
  const escalation = await assertActorHoldsPermissions(actorId, role.permissionKeys);
  if (!escalation.success) return escalation;
  return { success: true, data: { id: role.id, key: role.key, name: role.name } };
}
