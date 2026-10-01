import { authorizeActorOverUser } from "@/contexts/rbac";
import type { OperationResult } from "@/shared/types";
import { adminResetMfa } from "./service";

export type AdminResetMfaInput = { targetUserId: string };

// Celular perdido sem código de recuperação: o admin desliga a verificação da conta (a pessoa
// entra só com a senha e ativa de novo). Mesma hierarquia de congelar conta.
export async function adminResetMfaHandler(input: AdminResetMfaInput): Promise<OperationResult<{ reset: boolean }>> {
  if (!input.targetUserId) {
    return { success: false, error: { code: "auth.users.invalid_input", message: "Usuário não informado." } };
  }
  const authz = await authorizeActorOverUser("rbac.users.manage", input.targetUserId);
  if (!authz.authorized) return { success: false, error: authz.error };
  return adminResetMfa({ actorId: authz.actorId, targetUserId: input.targetUserId });
}
