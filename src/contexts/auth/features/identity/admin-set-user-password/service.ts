import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { hashPassword } from "../password-hashing";
import { writeUserPasswordHash } from "./store";
import type { AdminSetUserPasswordCommand, AdminSetUserPasswordResult } from "./types";
import { incrementSessionVersion } from "../../session/revoke-sessions/store";

const MIN_PASSWORD_LENGTH = 8;

export async function adminSetUserPassword(
  command: AdminSetUserPasswordCommand,
): Promise<AdminSetUserPasswordResult> {
  const handle = beginOperation({
    useCase: "auth.identity.admin-set-user-password",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  if (command.newPassword.length < MIN_PASSWORD_LENGTH) {
    const error = {
      code: "auth.identity.weak_password",
      message: `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const passwordHash = await hashPassword(command.newPassword);
  const updated = await writeUserPasswordHash(command.targetUserId, passwordHash);
  if (!updated) {
    const error = {
      code: "auth.identity.user_not_found",
      message: `Nenhum usuário encontrado com id "${command.targetUserId}".`,
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  endOperation(handle, {
    success: true,
    summary: `Ator ${command.actorId} redefiniu a senha do usuário ${command.targetUserId}.`,
  });

  // Senha redefinida pelo admin: quem estava logado com a senha antiga sai.
  await incrementSessionVersion(command.targetUserId);

  // Redefinir a credencial de outra pessoa é ação privilegiada — auditada sempre.
  await recordAuditEvent({
    action: "auth.admin-set-user-password",
    actor: { id: command.actorId, type: "user" },
    outcome: "success",
    summary: `Senha do usuário ${command.targetUserId} redefinida por ${command.actorId}.`,
    detail: { targetUserId: command.targetUserId },
  });

  return { success: true, data: { id: updated.id } };
}
