import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { rejectUserRegistration } from "@/contexts/auth";
import type { RejectRegistrationCommand, RejectRegistrationResult } from "./types";

export async function rejectRegistration(command: RejectRegistrationCommand): Promise<RejectRegistrationResult> {
  const handle = beginOperation({
    useCase: "rbac.registration-approval.reject-registration",
    actor: { id: command.actor.id, type: "user" },
    kind: "write",
  });

  const rejection = await rejectUserRegistration({ userId: command.userId });
  if (!rejection.success) {
    endOperation(handle, { success: false, error: rejection.error });
    return rejection;
  }

  const summary = `user:${command.actor.id} rejeitou o registro do usuário ${command.userId}.`;
  endOperation(handle, { success: true, summary });

  await recordAuditEvent({
    action: "rbac.reject-registration",
    actor: { id: command.actor.id, type: "user" as const },
    outcome: "success",
    summary,
    detail: { targetUserId: command.userId, reason: command.reason ?? null },
  });

  return { success: true, data: undefined };
}
