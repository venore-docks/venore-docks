import { recordAuditEvent } from "@/observability";
import type { OperationResult } from "@/shared/types";
import { disableMfa } from "../shared/store";

export async function adminResetMfa(command: { actorId: string; targetUserId: string }): Promise<OperationResult<{ reset: boolean }>> {
  const reset = await disableMfa(command.targetUserId);
  await recordAuditEvent({
    action: "auth.mfa.admin-reset",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary: `Verificação em duas etapas do usuário ${command.targetUserId} desativada por ${command.actorId}.`,
    detail: { targetUserId: command.targetUserId },
  });
  return { success: true, data: { reset } };
}
