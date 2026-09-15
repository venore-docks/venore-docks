// Sem authorizeActor: auth não depende de rbac (evitaria ciclo, ver provision-user/service.ts),
// logo não pode checar permissions. Só deve ser chamado por código que já autorizou o ator
// (hoje, exclusivamente rbac/features/registration-approval/reject-registration).
// Não usar diretamente de app/ ou plugins/.
import { rejectUserRegistration } from "./service";
import type { RejectUserRegistrationInput, RejectUserRegistrationResult } from "./types";

export async function rejectUserRegistrationHandler(input: RejectUserRegistrationInput): Promise<RejectUserRegistrationResult> {
  if (input.userId.trim().length === 0) {
    return { success: false, error: { code: "auth.registrations.invalid_id", message: "userId não pode ser vazio." } };
  }
  return rejectUserRegistration(input);
}
