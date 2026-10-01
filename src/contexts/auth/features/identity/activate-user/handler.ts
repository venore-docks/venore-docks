// Sem authorizeActor de propósito: é um passo de SISTEMA chamado só por pontos de composição
// (platform/registration/handle-user-registered.ts com aprovação desligada; bootstrap do primeiro
// superadmin em platform/registration/bootstrap-superadmin.ts e scripts/). Mesmo racional de
// provision-user. Não expor em Server Action nem no SDK de plugin.
import { activateUser } from "./service";
import type { ActivateUserCommand, ActivateUserResult } from "./types";

export async function activateUserHandler(command: ActivateUserCommand): Promise<ActivateUserResult> {
  if (command.userId.trim().length === 0) {
    return { success: false, error: { code: "auth.identity.invalid_id", message: "userId não pode ser vazio." } };
  }
  return activateUser(command);
}
