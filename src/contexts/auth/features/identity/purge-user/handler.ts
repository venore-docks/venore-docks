import { authorizeActor } from "@/contexts/rbac";
import { purgeUser } from "./service";
import type { PurgeUserInput, PurgeUserResult } from "./types";

// Gated por rbac.users.purge — fora de ADMIN_BASE_PERMISSION_KEYS, só superadmin (mesmo padrão de
// media.purge vs media.manage).
export async function purgeUserHandler(input: PurgeUserInput): Promise<PurgeUserResult> {
  if (input.targetUserId.trim().length === 0) {
    return { success: false, error: { code: "auth.identity.invalid_id", message: "targetUserId não pode ser vazio." } };
  }

  const authz = await authorizeActor("rbac.users.purge");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return purgeUser({ actorId: authz.actorId, targetUserId: input.targetUserId });
}
