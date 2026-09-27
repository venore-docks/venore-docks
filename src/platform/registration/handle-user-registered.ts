import { activateUser, provisionUser } from "@/contexts/auth";
import { grantDefaultRoleOnRegistration } from "@/contexts/rbac";
import { registerPlugins } from "@/platform/plugin-engine/register-plugins";
import type { OperationResult } from "@/shared/types";
import { ensureRegistrationSettingsRegistered, isApprovalRequired } from "./registration-settings";

export { REGISTRATION_APPROVAL_REQUIRED_SETTING_KEY } from "./registration-settings";

export type UserRegisteredInput = {
  id: string;
  email: string | null;
  name: string | null;
};

// Ponto de composição fora de auth e rbac (docs/venore-docks.md — regra 12): auth.config.ts
// (evento createUser do Auth.js) e o cadastro por senha chamam esta função.
//
// Fail-closed: a conta nasce "pending" (default do schema). Com aprovação exigida, fica assim;
// sem aprovação, é liberada E recebe o papel padrão. Qualquer falha no meio deixa a conta
// pendente — nunca aprovada sem decisão.
//
// O primeiro superadmin NÃO nasce mais aqui ("o próximo cadastro vira superadmin" deixava uma
// instância recém-publicada ser tomada por quem chegasse primeiro): é o /setup com SETUP_TOKEN
// (bootstrap-superadmin.ts) ou o instalador (npm run db:install:fresh).
export async function handleUserRegistered(user: UserRegisteredInput): Promise<OperationResult<void>> {
  // Garante settings default de plugin ativo e de registro antes do primeiro acesso. Idempotente.
  await registerPlugins();
  await ensureRegistrationSettingsRegistered();

  if (await isApprovalRequired()) {
    return provisionUser(user);
  }

  const activated = await activateUser({ userId: user.id, reason: "registration-auto-approval" });
  if (!activated.success) {
    return activated;
  }
  return grantDefaultRoleOnRegistration({ userId: user.id });
}
