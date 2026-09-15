import { authorizeActor } from "@/contexts/rbac";
import { unfreezeUser } from "./service";
import type { UnfreezeUserInput, UnfreezeUserResult } from "./types";

// Mesma permission de freeze-user/handler.ts — congelar e reativar são a mesma capacidade
// administrativa (gerenciar o ciclo de vida de uma conta já aprovada).
export async function unfreezeUserHandler(input: UnfreezeUserInput): Promise<UnfreezeUserResult> {
  if (input.targetUserId.trim().length === 0) {
    return { success: false, error: { code: "auth.identity.invalid_id", message: "targetUserId não pode ser vazio." } };
  }

  const authz = await authorizeActor("rbac.users.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return unfreezeUser({ actorId: authz.actorId, targetUserId: input.targetUserId });
}
