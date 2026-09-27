import { emailPort } from "@/infrastructure/email";
import { listAvailableAuthProviders } from "./providers";

// "Esqueci minha senha" só aparece com envio de e-mail configurado e login por senha ligado.
export function isPasswordResetAvailable(): boolean {
  if (!emailPort.isEnabled()) return false;
  return listAvailableAuthProviders().some((provider) => provider.kind === "password" && provider.enabled);
}
