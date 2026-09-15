import { authorizeActor } from "@/contexts/rbac";
import { freezeUser } from "./service";
import type { FreezeUserInput, FreezeUserResult } from "./types";

// Gated por rbac.users.manage. authorizeActor mora em rbac, que já depende de auth — o barrel de
// rbac só chama o barrel de auth em request-time, então o import não fecha ciclo de avaliação
// (mesmo padrão de admin-set-user-password/handler.ts).
export async function freezeUserHandler(input: FreezeUserInput): Promise<FreezeUserResult> {
  if (input.targetUserId.trim().length === 0) {
    return { success: false, error: { code: "auth.identity.invalid_id", message: "targetUserId não pode ser vazio." } };
  }

  const authz = await authorizeActor("rbac.users.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return freezeUser({ actorId: authz.actorId, targetUserId: input.targetUserId, reason: input.reason });
}
