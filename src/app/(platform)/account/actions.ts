"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import {
  confirmMfaEnrollment,
  disableOwnMfa,
  getOwnMfaStatus,
  revokeOwnSessions,
  setOwnName,
  setOwnPassword,
  startMfaEnrollment,
  updateOwnAvatar,
} from "@/contexts/auth";
import { getBrandConfig } from "@/platform/brand/get-brand-config";
import { uploadAvatarMediaAsset } from "@/contexts/media";

export type AccountActionState = { error: string | null };

// setOwnName recusa quando authProvider da sessão não é "credentials" (conta OAuth tem o nome
// gerenciado pelo provedor) — o form nem aparece nesse caso (page.tsx), isto é defesa em
// profundidade caso a action seja chamada de outro jeito.
export async function updateOwnNameAction(_prevState: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const name = String(formData.get("name") ?? "");

  const result = await setOwnName({ name });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/account");
  return { error: null };
}

// Mesmo padrão de /admin/cms/actions.ts: erro do handler devolvido de verdade via
// useActionState, nunca descartado silenciosamente (docs/venore-docks.md).
export async function updateOwnAvatarAction(_prevState: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const avatarMediaId = String(formData.get("avatarMediaId") ?? "").trim();

  const result = await updateOwnAvatar({ avatarMediaId: avatarMediaId || null });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/account");
  return { error: null };
}

// Envia a imagem (upload-avatar-media: qualquer ator autenticado, sempre privada, < 500KB) e já
// aplica como avatar do próprio ator — um só passo, não passa pelo picker da biblioteca geral.
export async function uploadAvatarAction(_prevState: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem para enviar." };
  }

  const data = Buffer.from(await file.arrayBuffer());

  const uploadResult = await uploadAvatarMediaAsset({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    data,
  });

  if (!uploadResult.success) {
    return { error: uploadResult.error.message };
  }

  const avatarResult = await updateOwnAvatar({ avatarMediaId: uploadResult.data.id });
  if (!avatarResult.success) {
    return { error: avatarResult.error.message };
  }

  revalidatePath("/account");
  return { error: null };
}

// Troca de senha: pede a atual (setOwnPassword recusa sem ela quando a conta já tem senha) e
// derruba as outras sessões; esta continua (o handler renova o token).
export async function changeOwnPasswordAction(_prevState: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword !== String(formData.get("confirmPassword") ?? "")) {
    return { error: "A confirmação não bate com a nova senha." };
  }

  const result = await setOwnPassword({ newPassword, currentPassword: String(formData.get("currentPassword") ?? "") });
  if (!result.success) {
    return { error: result.error.message };
  }

  // redirect (não re-render no mesmo request): a página só enxerga o cookie renovado no próximo.
  redirect("/account?aviso=senha-alterada");
}

// "Sair de todos os outros dispositivos": invalida todo JWT já emitido e renova o desta sessão.
export async function revokeOtherSessionsAction(): Promise<AccountActionState> {
  const result = await revokeOwnSessions();
  if (!result.success) {
    return { error: result.error.message };
  }

  redirect("/account?aviso=sessoes-encerradas");
}

// Verificação em duas etapas: 1) gerar o segredo (QR + texto), 2) confirmar com um código do app
// (devolve os códigos de recuperação, mostrados uma vez), 3) desligar com um código válido.
export type MfaActionState = {
  error: string | null;
  step: "idle" | "scan" | "done";
  qrSvg: string | null;
  secret: string | null;
  recoveryCodes: string[] | null;
};

export async function startMfaEnrollmentAction(): Promise<MfaActionState> {
  // Sessão primeiro: getBrandConfig grava defaults de settings e não deve rodar pra anônimo.
  const status = await getOwnMfaStatus();
  if (!status.success) {
    return { error: status.error.message, step: "idle", qrSvg: null, secret: null, recoveryCodes: null };
  }
  const { siteName } = await getBrandConfig();
  const result = await startMfaEnrollment({ issuer: siteName });
  if (!result.success) {
    return { error: result.error.message, step: "idle", qrSvg: null, secret: null, recoveryCodes: null };
  }
  // SVG gerado aqui a partir do URI otpauth (nada vindo do usuário vai no SVG).
  const qrSvg = await QRCode.toString(result.data.otpauthUri, { type: "svg", margin: 2, width: 200, color: { dark: "#000000", light: "#ffffff" } });
  return { error: null, step: "scan", qrSvg, secret: result.data.secret, recoveryCodes: null };
}

export async function confirmMfaEnrollmentAction(prev: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const result = await confirmMfaEnrollment({ code: String(formData.get("code") ?? "") });
  if (!result.success) {
    return { ...prev, error: result.error.message };
  }
  // Sem revalidatePath de propósito: re-renderizar /account trocaria este formulário pelo de
  // "desativar" (MFA já ativo) e os códigos de recuperação sumiriam antes de a pessoa guardá-los.
  return { error: null, step: "done", qrSvg: null, secret: null, recoveryCodes: result.data.recoveryCodes };
}

export async function disableMfaAction(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const result = await disableOwnMfa({ code: String(formData.get("code") ?? "") });
  if (!result.success) {
    return { error: result.error.message };
  }
  revalidatePath("/account");
  return { error: null };
}
