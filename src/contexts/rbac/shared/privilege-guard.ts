import type { OperationResult } from "@/shared/types";
import { getUserContext } from "../features/role-assignment/get-user-context/service";

// Trava anti-escalonamento compartilhada pelos service.ts de rbac que mexem em papel/atribuição.
// Regra: quem não é superadmin só concede (a um papel, ou a um usuário via papel) permissions que
// ele mesmo já tem, e nunca mexe no papel superadmin nem nos papéis de um superadmin. Sem isso o
// papel "admin" (rbac.roles.manage + rbac.roles.assign) se promovia a superadmin e as permissions
// "reservadas" (media.purge, rbac.users.purge...) eram decorativas.

export const SUPERADMIN_ROLE_KEY = "superadmin";

type GuardResult = OperationResult<void>;

const ok: GuardResult = { success: true, data: undefined };

function forbidden(code: string, message: string): GuardResult {
  return { success: false, error: { code, message } };
}

async function loadActor(actorId: string) {
  const context = await getUserContext({ userId: actorId });
  return context.success ? context.data : null;
}

export async function assertActorIsSuperadmin(actorId: string, message: string): Promise<GuardResult> {
  const actor = await loadActor(actorId);
  if (!actor?.isSuperadmin) {
    return forbidden("rbac.roles.superadmin_required", message);
  }
  return ok;
}

// Todas as keys pedidas precisam estar entre as permissions do ator (superadmin passa sempre).
export async function assertActorHoldsPermissions(actorId: string, permissionKeys: string[]): Promise<GuardResult> {
  const actor = await loadActor(actorId);
  if (!actor) {
    return forbidden("rbac.roles.privilege_escalation", "Não foi possível verificar as permissões do ator.");
  }
  if (actor.isSuperadmin) return ok;

  const missing = [...new Set(permissionKeys)].filter((key) => !actor.permissions.includes(key));
  if (missing.length > 0) {
    return forbidden(
      "rbac.roles.privilege_escalation",
      `Você não pode conceder permissões que não tem: ${missing.join(", ")}.`,
    );
  }
  return ok;
}

// Atribuir/remover papel de um usuário: o papel superadmin e os papéis de quem é superadmin só
// podem ser mexidos por um superadmin.
export async function assertActorCanManageUserRoles(
  actorId: string,
  targetUserId: string,
  roleKey: string,
): Promise<GuardResult> {
  const [actor, target] = await Promise.all([loadActor(actorId), loadActor(targetUserId)]);
  if (actor?.isSuperadmin) return ok;

  if (roleKey === SUPERADMIN_ROLE_KEY) {
    return forbidden("rbac.roles.superadmin_required", "Só um superadmin pode conceder ou remover o papel superadmin.");
  }
  if (target?.isSuperadmin) {
    return forbidden("rbac.roles.superadmin_required", "Só um superadmin pode alterar os papéis de outro superadmin.");
  }
  return ok;
}
