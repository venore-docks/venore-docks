import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { findRemovedUserStatus, hardDeleteUserById, isForeignKeyViolation } from "./store";
import type { PurgeUserCommand, PurgeUserResult } from "./types";

// Hard delete real — só age sobre usuário já removido (remove-user), mesmo padrão de
// purge-media-asset/service.ts. Não checa cms/media aqui (auth não pode importar esses contexts,
// regra 12/14): quem chama isto é platform/identity-lifecycle/purge-user-safely.ts, que já
// reconfirma ausência de conteúdo antes de chegar até aqui.
export async function purgeUser(command: PurgeUserCommand): Promise<PurgeUserResult> {
  const handle = beginOperation({
    useCase: "auth.identity.purge-user",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const status = await findRemovedUserStatus(command.targetUserId);
  if (status === null) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  if (status !== "removed") {
    const error = {
      code: "auth.purge.not_removed",
      message: `Usuário "${command.targetUserId}" não está removido — só uma conta já removida pode ser apagada definitivamente.`,
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  try {
    await hardDeleteUserById(command.targetUserId);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      const fkError = {
        code: "auth.purge.still_referenced",
        message: "Esta conta ainda está referenciada em algum conteúdo — não é possível apagar definitivamente.",
      };
      endOperation(handle, { success: false, error: fkError });
      return { success: false, error: fkError };
    }
    throw error;
  }

  const summary = `Ator ${command.actorId} apagou definitivamente a conta do usuário ${command.targetUserId}.`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "auth.purge-user",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary,
    detail: { targetUserId: command.targetUserId },
  });

  return { success: true, data: { id: command.targetUserId } };
}
