import {
  acceptInvitation as acceptInvitationData,
  createInvitation,
  getInvitation,
  listApprovedUserContacts,
  listPendingInvitations,
  revokeInvitation,
  type InvitationRow,
} from "@/contexts/auth";
import { assignRoleOnBehalfOf, authorizeActor, checkActorCanGrantRole, grantDefaultRoleOnRegistration, listRoles } from "@/contexts/rbac";
import { emailPort } from "@/infrastructure/email";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import type { OperationResult } from "@/shared/types";

// Convites: quem tem rbac.users.manage convida alguém (e-mail + papel). O link cria a conta já
// aprovada, com o papel — funciona mesmo com o autocadastro fechado. Sem provedor de e-mail, o
// link aparece pra quem convidou copiar e mandar por outro meio.
const INVITE_PERMISSION = "rbac.users.manage";

export type InviteResult = OperationResult<{ link: string; emailed: boolean; expiresAt: Date }>;

export async function inviteUser(input: { email: string; roleId: string; origin: string }): Promise<InviteResult> {
  const authz = await authorizeActor(INVITE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };

  // Mesmas travas de atribuir papel: ninguém convida pra um papel com permission que não tem.
  const role = await checkActorCanGrantRole(authz.actorId, input.roleId);
  if (!role.success) return role;

  const created = await createInvitation({ email: input.email, roleId: role.data.id, invitedBy: authz.actorId });
  if (!created.success) return created;

  const link = `${input.origin}/convite/${created.data.token}`;
  const { siteName } = await getBrandConfig();
  const [inviter] = await listApprovedUserContacts([authz.actorId]);
  const sent = emailPort.isEnabled()
    ? await emailPort.send({
        to: input.email.trim().toLowerCase(),
        subject: `Convite para ${siteName}`,
        text: `${inviter?.name ?? "Uma pessoa da equipe"} convidou você para ${siteName} como "${role.data.name}".\n\nCrie sua conta pelo link abaixo (válido por 7 dias):\n\n${link}`,
      })
    : { sent: false as const, reason: "sem e-mail" };

  return { success: true, data: { link, emailed: sent.sent, expiresAt: created.data.expiresAt } };
}

export async function previewInvitation(token: string) {
  return getInvitation(token);
}

// Aceite: cria a conta e atribui o papel EM NOME de quem convidou (as travas de privilégio rodam
// contra essa pessoa de novo — se ela perdeu a permissão nesse meio tempo, a conta fica só com o
// papel padrão).
export async function acceptInvitation(input: { token: string; name: string; password: string }): Promise<OperationResult<{ userId: string }>> {
  const accepted = await acceptInvitationData(input);
  if (!accepted.success) return accepted;

  const assigned = await assignRoleOnBehalfOf({ userId: accepted.data.userId, roleId: accepted.data.roleId, actor: { id: accepted.data.invitedBy } });
  if (!assigned.success) {
    await grantDefaultRoleOnRegistration({ userId: accepted.data.userId });
  }
  return { success: true, data: { userId: accepted.data.userId } };
}

export type PendingInvitationView = InvitationRow & { roleName: string };

export async function listInvitationsForAdmin(): Promise<OperationResult<PendingInvitationView[]>> {
  const authz = await authorizeActor(INVITE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  const [pending, roles] = await Promise.all([listPendingInvitations(), listRoles()]);
  if (!pending.success) return pending;
  const roleNameById = new Map((roles.success ? roles.data : []).map((role) => [role.id, role.name]));
  return { success: true, data: pending.data.map((row) => ({ ...row, roleName: roleNameById.get(row.roleId) ?? "—" })) };
}

export async function cancelInvitation(id: string): Promise<OperationResult<{ revoked: boolean }>> {
  const authz = await authorizeActor(INVITE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return revokeInvitation(id);
}
