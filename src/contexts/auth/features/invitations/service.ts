import type { OperationResult } from "@/shared/types";
import { generatePasswordResetToken, hashPasswordResetToken } from "../../shared/password-reset-token";
import { hashPassword } from "../identity/password-hashing";
import {
  consumeByTokenHash,
  emailHasAccount,
  findPendingByTokenHash,
  insertInvitedUser,
  listPendingInvitations as listPending,
  replaceInvitation,
  revokeInvitationById,
  type InvitationRow,
} from "./store";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID = { success: false as const, error: { code: "auth.invitation.invalid", message: "Convite inválido, expirado ou já usado." } };

export type { InvitationRow };

// Operações de DADO dos convites. Autorização (quem pode convidar, e pra qual papel) e a atribuição
// do papel ficam na composição (platform/registration/invitations.ts) — auth não conhece papéis.
export async function createInvitation(input: {
  email: string;
  roleId: string;
  invitedBy: string;
}): Promise<OperationResult<{ id: string; token: string; expiresAt: Date }>> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    return { success: false, error: { code: "auth.registration.invalid_email", message: "Informe um email válido." } };
  }
  if (await emailHasAccount(email)) {
    return { success: false, error: { code: "auth.invitation.email_taken", message: "Já existe uma conta com este e-mail." } };
  }
  const token = generatePasswordResetToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const id = await replaceInvitation({ email, roleId: input.roleId, invitedBy: input.invitedBy, tokenHash: hashPasswordResetToken(token), expiresAt });
  return { success: true, data: { id, token, expiresAt } };
}

export async function getInvitation(token: string): Promise<OperationResult<{ email: string; expiresAt: Date }>> {
  const row = token ? await findPendingByTokenHash(hashPasswordResetToken(token), new Date()) : null;
  return row ? { success: true, data: { email: row.email, expiresAt: row.expiresAt } } : INVALID;
}

// Cria a conta (já aprovada) e consome o convite. Quem chama atribui o papel do convite.
export async function acceptInvitation(input: {
  token: string;
  name: string;
  password: string;
}): Promise<OperationResult<{ userId: string; roleId: string; invitedBy: string }>> {
  const name = input.name.trim();
  if (!name || name.length > 120) return { success: false, error: { code: "auth.registration.invalid_name", message: "Informe seu nome." } };
  if (input.password.length < 8) {
    return { success: false, error: { code: "auth.registration.weak_password", message: "A senha precisa ter ao menos 8 caracteres." } };
  }
  const invitation = await consumeByTokenHash(hashPasswordResetToken(input.token.trim()), new Date());
  if (!invitation) return INVALID;
  if (await emailHasAccount(invitation.email)) {
    return { success: false, error: { code: "auth.invitation.email_taken", message: "Já existe uma conta com este e-mail. Entre normalmente." } };
  }
  const userId = await insertInvitedUser(invitation.email, name, await hashPassword(input.password));
  return { success: true, data: { userId, roleId: invitation.roleId, invitedBy: invitation.invitedBy } };
}

export async function listPendingInvitations(): Promise<OperationResult<InvitationRow[]>> {
  return { success: true, data: await listPending(new Date()) };
}

export async function revokeInvitation(id: string): Promise<OperationResult<{ revoked: boolean }>> {
  return { success: true, data: { revoked: await revokeInvitationById(id) } };
}
