import { findAvatarMediaId, getSession } from "./store";
import { toAuthenticatedUser } from "./view";
import type { GetCurrentUserResult } from "./types";

export async function getCurrentUserService(): Promise<GetCurrentUserResult> {
  const session = await getSession();

  if (!session?.user) {
    return { success: true, data: null };
  }

  // P9 (generalizado) — só "approved" autentica: pending/rejected/frozen/removed tratam como não
  // autenticado em todo lugar que resolve identidade (authorizeActor, gate de admin, handlers
  // self-service), cobrindo Server Actions e /api que o redirect de (platform)/layout.tsx não
  // alcança. O status vem do callback session de auth.config.ts, consultado no banco a cada
  // request — congelar/remover um usuário already-logado corta o acesso dele no próximo request,
  // sem precisar revogar sessão à parte (estratégia é JWT, não database session).
  if (session.user.status !== "approved") {
    return { success: true, data: null };
  }

  const avatarMediaId = await findAvatarMediaId(session.user.id);
  return { success: true, data: toAuthenticatedUser(session.user, avatarMediaId) };
}
