import { authorizeActorOverUser } from "@/contexts/rbac";
import { adminSetUserPassword } from "./service";
import type { AdminSetUserPasswordInput, AdminSetUserPasswordResult } from "./types";

// Gated por rbac.roles.manage (mesma permission que gerencia papéis/usuários). authorizeActor mora
// em rbac, que já depende de auth — o barrel de rbac só chama o barrel de auth em request-time,
// então o import não fecha ciclo de avaliação (mesmo padrão de update-own-avatar → @/contexts/media).
export async function adminSetUserPasswordHandler(
  input: AdminSetUserPasswordInput,
): Promise<AdminSetUserPasswordResult> {
  if (input.targetUserId.trim().length === 0) {
    return {
      success: false,
      error: { code: "auth.identity.invalid_id", message: "targetUserId não pode ser vazio." },
    };
  }

  // Bootstrap: o instalador (scripts/install-fresh.ts) roda sem sessão e define a credencial do
  // primeiro usuário — não há outro ator, então o próprio usuário consta como ator da operação.
  // Mesmo racional do `bypassExistsCheck` de grant-superadmin/handler.ts.
  if (input.bypassAuthorization) {
    return adminSetUserPassword({
      actorId: input.targetUserId,
      targetUserId: input.targetUserId,
      newPassword: input.newPassword,
    });
  }

  // Só superadmin redefine a senha de um superadmin — sem isso, rbac.roles.manage (papel "admin")
  // tomava a conta do dono da instância.
  const authz = await authorizeActorOverUser("rbac.roles.manage", input.targetUserId, { allowSelf: true });
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return adminSetUserPassword({
    actorId: authz.actorId,
    targetUserId: input.targetUserId,
    newPassword: input.newPassword,
  });
}
