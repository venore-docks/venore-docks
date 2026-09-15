"use server";

import { revalidatePath } from "next/cache";
import { adminCreateUser, adminSetUserPassword, freezeUser, removeUser, unfreezeUser } from "@/contexts/auth";
import { approveRegistration, grantDefaultRoleOnRegistration, rejectRegistration } from "@/contexts/rbac";
import { purgeUserSafely } from "@/platform/identity-lifecycle/purge-user-safely";

export type CommunityActionState = { error: string | null };

// Toda action revalida a lista e, quando aplicável, o perfil individual — as duas telas leem os
// mesmos dados (status, papéis) e podem estar abertas em abas diferentes.
function revalidateCommunity(userId?: string) {
  revalidatePath("/admin/community");
  if (userId) revalidatePath(`/admin/community/${userId}`);
}

export async function approveUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const userId = String(formData.get("userId") ?? "");
  const result = await approveRegistration({ userId });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(userId);
  return { error: null };
}

export async function rejectUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const result = await rejectRegistration({ userId, reason: reason || undefined });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(userId);
  return { error: null };
}

export async function freezeUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const result = await freezeUser({ targetUserId, reason: reason || undefined });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(targetUserId);
  return { error: null };
}

export async function unfreezeUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const result = await unfreezeUser({ targetUserId });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(targetUserId);
  return { error: null };
}

export async function removeUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const result = await removeUser({ targetUserId, reason: reason || undefined });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(targetUserId);
  return { error: null };
}

export async function purgeUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const result = await purgeUserSafely({ targetUserId });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(targetUserId);
  return { error: null };
}

export async function resetUserPasswordAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const result = await adminSetUserPassword({ targetUserId, newPassword });
  if (!result.success) return { error: result.error.message };

  revalidateCommunity(targetUserId);
  return { error: null };
}

// Composição auth + rbac na camada de app (mesmo espírito de admin/rbac/page.tsx já compor
// listUsers de auth com listRoles/listUsersByRole de rbac): auth não pode importar rbac pra
// atribuir papel, então quem faz os dois passos é o Server Action, não uma feature de um dos dois
// contexts. Conta criada pelo admin recebe o papel padrão de registro ("member"), igual ao
// autorregistro sem aprovação manual (platform/registration/handle-user-registered.ts).
export async function addUserAction(_prevState: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const password = String(formData.get("password") ?? "");

  const created = await adminCreateUser({ email, name, password });
  if (!created.success) return { error: created.error.message };

  const roleGrant = await grantDefaultRoleOnRegistration({ userId: created.data.id });
  if (!roleGrant.success) return { error: roleGrant.error.message };

  revalidateCommunity();
  return { error: null };
}
