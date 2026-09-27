import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { incrementSessionVersion } from "./store";
import type { RevokeSessionsCommand, RevokeSessionsResult } from "./types";

// Invalida toda sessão já emitida do usuário (o JWT carrega a versão do login; o callback session
// compara com o banco a cada request).
export async function revokeSessions(command: RevokeSessionsCommand): Promise<RevokeSessionsResult> {
  const handle = beginOperation({
    useCase: "auth.revoke-sessions",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const sessionVersion = await incrementSessionVersion(command.userId);
  if (sessionVersion === null) {
    const error = { code: "auth.users.not_found", message: "Usuário não encontrado." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  endOperation(handle, { success: true, summary: `Sessões de ${command.userId} encerradas (${command.reason}).` });
  await recordAuditEvent({
    action: "auth.sessions.revoked",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary: `Sessões do usuário ${command.userId} encerradas (${command.reason}).`,
    detail: { userId: command.userId, reason: command.reason },
  });
  return { success: true, data: { sessionVersion } };
}
