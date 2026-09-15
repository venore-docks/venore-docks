import { authorizeActor } from "@/contexts/rbac";
import { removeUser } from "./service";
import type { RemoveUserInput, RemoveUserResult } from "./types";

// Gated por rbac.users.remove (separada de rbac.users.manage — remoção é irreversível na prática,
// mesmo padrão de media.purge vs media.manage). Não está em ADMIN_BASE_PERMISSION_KEYS: só
// superadmin, que authorize-actor.ts libera incondicional.
export async function removeUserHandler(input: RemoveUserInput): Promise<RemoveUserResult> {
  if (input.targetUserId.trim().length === 0) {
    return { success: false, error: { code: "auth.identity.invalid_id", message: "targetUserId não pode ser vazio." } };
  }

  const authz = await authorizeActor("rbac.users.remove");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return removeUser({ actorId: authz.actorId, targetUserId: input.targetUserId, reason: input.reason });
}
