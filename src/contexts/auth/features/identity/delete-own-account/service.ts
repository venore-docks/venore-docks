import { verifyPasswordHash } from "../password-hashing";
import { removeUser } from "../remove-user/service";
import { findOwnCredential } from "./store";
import type { DeleteOwnAccountInput, DeleteOwnAccountResult } from "./types";

// Exclusão pela própria pessoa (LGPD): mesma anonimização da remoção pelo admin (e-mail, nome e
// senha apagados, status "removed" — as sessões caem no próximo request). O conteúdo que ela
// publicou continua no site, sem vínculo com os dados pessoais.
export async function deleteOwnAccount(userId: string, input: DeleteOwnAccountInput): Promise<DeleteOwnAccountResult> {
  const credential = await findOwnCredential(userId);
  if (!credential) {
    return { success: false, error: { code: "auth.identity.user_not_found", message: "Usuário não encontrado." } };
  }
  if (credential.email.toLowerCase() !== input.confirmEmail.trim().toLowerCase()) {
    return { success: false, error: { code: "auth.identity.confirmation_mismatch", message: "O e-mail digitado não é o desta conta." } };
  }
  if (credential.passwordHash && !(await verifyPasswordHash(input.password ?? "", credential.passwordHash))) {
    return { success: false, error: { code: "auth.identity.wrong_current_password", message: "A senha não confere." } };
  }
  return removeUser({ actorId: userId, targetUserId: userId, reason: "self-service (LGPD)" });
}
