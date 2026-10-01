import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { hashPasswordResetToken } from "../../../shared/password-reset-token";
import { hashPassword } from "../password-hashing";
import { incrementSessionVersion } from "../../session/revoke-sessions/store";
import { consumeResetToken, deleteResetTokensOfUser, findUserStatus, writePasswordHash } from "./store";
import type { ResetPasswordWithTokenInput, ResetPasswordWithTokenResult } from "./types";

const MIN_PASSWORD_LENGTH = 8;

const INVALID_TOKEN = {
  success: false as const,
  error: { code: "auth.password_reset.invalid_token", message: "Este link de recuperação é inválido ou expirou. Peça um novo." },
};

export async function resetPasswordWithToken(input: ResetPasswordWithTokenInput): Promise<ResetPasswordWithTokenResult> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: { code: "auth.registration.weak_password", message: `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` } };
  }

  const handle = beginOperation({ useCase: "auth.reset-password-with-token", actor: { id: "anonymous", type: "system" }, kind: "write" });

  const userId = await consumeResetToken(hashPasswordResetToken(input.token), new Date());
  // Conta congelada/removida depois do pedido também não recupera acesso por aqui.
  if (!userId || (await findUserStatus(userId)) !== "approved") {
    endOperation(handle, { success: false, error: INVALID_TOKEN.error });
    return INVALID_TOKEN;
  }

  await writePasswordHash(userId, await hashPassword(input.newPassword));
  await deleteResetTokensOfUser(userId);
  // Quem estava logado com a senha antiga (inclusive quem pediu a troca sem ser o dono) sai.
  await incrementSessionVersion(userId);

  endOperation(handle, { success: true, summary: `Senha do usuário ${userId} redefinida por link de e-mail.` });
  await recordAuditEvent({
    action: "auth.password-reset",
    actor: { id: userId, type: "user" },
    outcome: "success",
    summary: `Senha redefinida por link de recuperação (usuário ${userId}).`,
    detail: { userId },
  });
  return { success: true, data: { userId } };
}
