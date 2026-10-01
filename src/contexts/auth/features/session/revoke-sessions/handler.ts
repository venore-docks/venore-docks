import { authorizeActorOverUser } from "@/contexts/rbac";
import { getCurrentUserHandler } from "../get-current-user/handler";
import { renewCurrentSession } from "./renew-current-session";
import { revokeSessions } from "./service";
import type { RevokeSessionsResult, RevokeUserSessionsInput } from "./types";

// "Sair de todos os dispositivos" da própria conta — esta sessão é renovada e continua valendo.
// Quem chama deve terminar com redirect: a renderização no mesmo request ainda enxerga o cookie
// antigo (auth() lê pelo headers()).
export async function revokeOwnSessionsHandler(): Promise<RevokeSessionsResult> {
  const current = await getCurrentUserHandler();
  if (!current.success || !current.data) {
    return { success: false, error: { code: "auth.unauthenticated", message: "É necessário estar autenticado." } };
  }
  const result = await revokeSessions({ userId: current.data.id, actorId: current.data.id, reason: "self" });
  if (result.success) await renewCurrentSession(current.data.id);
  return result;
}

// Admin encerrando as sessões de outra pessoa — mesma hierarquia de congelar conta.
export async function revokeUserSessionsHandler(input: RevokeUserSessionsInput): Promise<RevokeSessionsResult> {
  if (!input.targetUserId) {
    return { success: false, error: { code: "auth.users.invalid_input", message: "Usuário não informado." } };
  }
  const authz = await authorizeActorOverUser("rbac.users.manage", input.targetUserId);
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }
  return revokeSessions({ userId: input.targetUserId, actorId: authz.actorId, reason: "admin" });
}
