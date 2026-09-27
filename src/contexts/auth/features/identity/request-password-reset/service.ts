import { emailPort } from "@/infrastructure/email";
import { beginOperation, endOperation } from "@/observability";
import { PASSWORD_RESET_TTL_MS, generatePasswordResetToken, hashPasswordResetToken } from "../../../shared/password-reset-token";
import { findResettableUser, hasRecentResetToken, insertResetToken } from "./store";
import type { RequestPasswordResetInput, RequestPasswordResetResult } from "./types";

// Um e-mail a cada 2 min por conta, no máximo — segura o reenvio em loop sem avisar ninguém.
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

const ACCEPTED: RequestPasswordResetResult = { success: true, data: { accepted: true } };

export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<RequestPasswordResetResult> {
  if (!emailPort.isEnabled()) {
    return { success: false, error: { code: "auth.password_reset.unavailable", message: "Recuperação de senha por e-mail não está disponível." } };
  }

  const handle = beginOperation({ useCase: "auth.request-password-reset", actor: { id: "anonymous", type: "system" }, kind: "write" });

  // Conta inexistente, pendente ou bloqueada: mesma resposta, nada enviado.
  const user = await findResettableUser(input.email);
  if (!user || (await hasRecentResetToken(user.id, new Date(Date.now() - RESEND_COOLDOWN_MS)))) {
    endOperation(handle, { success: true, summary: "Pedido de recuperação sem envio." });
    return ACCEPTED;
  }

  const token = generatePasswordResetToken();
  await insertResetToken(user.id, hashPasswordResetToken(token), new Date(Date.now() + PASSWORD_RESET_TTL_MS));

  const link = `${input.resetUrl}?token=${encodeURIComponent(token)}`;
  const greeting = user.name ? `Olá, ${user.name}.` : "Olá.";
  const sent = await emailPort.send({
    to: user.email,
    subject: "Redefinir sua senha",
    text: `${greeting}\n\nRecebemos um pedido para redefinir a senha da sua conta. Use o link abaixo em até 1 hora:\n\n${link}\n\nSe não foi você, ignore este e-mail — sua senha continua a mesma.`,
  });

  if (!sent.sent) {
    endOperation(handle, { success: false, error: { code: "auth.password_reset.send_failed", message: sent.reason } });
  } else {
    endOperation(handle, { success: true, summary: `Link de recuperação enviado para o usuário ${user.id}.` });
  }
  // Falha de envio também responde "aceito": a pessoa não deve saber se a conta existe.
  return ACCEPTED;
}
