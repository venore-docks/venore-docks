import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { anonymizeUser, findUserStatus } from "./store";
import type { RemoveUserCommand, RemoveUserResult } from "./types";

export async function removeUser(command: RemoveUserCommand): Promise<RemoveUserResult> {
  const handle = beginOperation({
    useCase: "auth.identity.remove-user",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const status = await findUserStatus(command.targetUserId);
  if (status === null) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  if (status === "removed") {
    const error = { code: "auth.identity.already_removed", message: `Usuário "${command.targetUserId}" já foi removido.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const updated = await anonymizeUser(command.targetUserId);
  if (!updated) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const summary = `Ator ${command.actorId} removeu a conta do usuário ${command.targetUserId}.`;
  endOperation(handle, { success: true, summary });

  // Remoção é irreversível na prática (anonimiza email/nome/senha) — auditada sempre.
  await recordAuditEvent({
    action: "auth.remove-user",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary,
    detail: { targetUserId: command.targetUserId, reason: command.reason ?? null },
  });

  return { success: true, data: { id: updated.id } };
}
