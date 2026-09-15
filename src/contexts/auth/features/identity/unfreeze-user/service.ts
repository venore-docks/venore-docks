import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { findUserStatus, writeUserStatus } from "./store";
import type { UnfreezeUserCommand, UnfreezeUserResult } from "./types";

export async function unfreezeUser(command: UnfreezeUserCommand): Promise<UnfreezeUserResult> {
  const handle = beginOperation({
    useCase: "auth.identity.unfreeze-user",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const status = await findUserStatus(command.targetUserId);
  if (status === null) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  if (status !== "frozen") {
    const error = { code: "auth.identity.not_frozen", message: `Usuário "${command.targetUserId}" não está congelado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const updated = await writeUserStatus(command.targetUserId, "approved");
  if (!updated) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const summary = `Ator ${command.actorId} reativou a conta do usuário ${command.targetUserId}.`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "auth.unfreeze-user",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary,
    detail: { targetUserId: command.targetUserId },
  });

  return { success: true, data: { id: updated.id } };
}
