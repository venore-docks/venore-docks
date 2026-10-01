import { resetPasswordWithToken } from "./service";
import type { ResetPasswordWithTokenInput, ResetPasswordWithTokenResult } from "./types";

// Público: a posse do token (enviado ao e-mail da conta) é a autorização.
export async function resetPasswordWithTokenHandler(input: ResetPasswordWithTokenInput): Promise<ResetPasswordWithTokenResult> {
  const token = input.token.trim();
  if (!token || token.length > 200) {
    return { success: false, error: { code: "auth.password_reset.invalid_token", message: "Este link de recuperação é inválido ou expirou. Peça um novo." } };
  }
  return resetPasswordWithToken({ token, newPassword: input.newPassword });
}
