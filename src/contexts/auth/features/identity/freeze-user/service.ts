import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { findUserStatus, writeUserStatus } from "./store";
import type { FreezeUserCommand, FreezeUserResult } from "./types";

export async function freezeUser(command: FreezeUserCommand): Promise<FreezeUserResult> {
  const handle = beginOperation({
    useCase: "auth.identity.freeze-user",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const status = await findUserStatus(command.targetUserId);
  if (status === null) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  if (status !== "approved") {
    const error = { code: "auth.identity.not_approved", message: `Usuário "${command.targetUserId}" não está com status "approved".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const updated = await writeUserStatus(command.targetUserId, "frozen");
  if (!updated) {
    const error = { code: "auth.identity.user_not_found", message: `Nenhum usuário encontrado com id "${command.targetUserId}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const summary = `Ator ${command.actorId} congelou a conta do usuário ${command.targetUserId}.`;
  endOperation(handle, { success: true, summary });

  // Congelar conta é ação privilegiada — auditada sempre (mesmo padrão de admin-set-user-password).
  await recordAuditEvent({
    action: "auth.freeze-user",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary,
    detail: { targetUserId: command.targetUserId, reason: command.reason ?? null },
  });

  return { success: true, data: { id: updated.id } };
}
