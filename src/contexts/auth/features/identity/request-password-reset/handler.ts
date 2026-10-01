import { requestPasswordReset } from "./service";
import type { RequestPasswordResetInput, RequestPasswordResetResult } from "./types";

// Público (quem esqueceu a senha não tem sessão). Limite de tentativas fica em quem chama (action,
// por IP e por e-mail).
export async function requestPasswordResetHandler(input: RequestPasswordResetInput): Promise<RequestPasswordResetResult> {
  const email = input.email.trim();
  if (!email || email.length > 320 || !email.includes("@")) {
    return { success: false, error: { code: "auth.registration.invalid_email", message: "Informe um email válido." } };
  }
  return requestPasswordReset({ email, resetUrl: input.resetUrl });
}
