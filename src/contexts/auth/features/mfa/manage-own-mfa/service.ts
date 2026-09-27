import { beginOperation, endOperation, recordAuditEvent } from "@/observability";
import { openSecret, sealSecret } from "../../../shared/secret-box";
import { buildOtpauthUri, generateTotpSecret, matchTotp } from "../../../shared/totp";
import { generateRecoveryCodes, hashRecoveryCode } from "../shared/recovery-codes";
import { countUnusedRecoveryCodes, disableMfa, enableMfa, findMfaRow, setPendingSecret } from "../shared/store";
import { verifyMfaCode } from "../verify-mfa-login/service";
import type {
  ConfirmMfaEnrollmentResult,
  DisableOwnMfaResult,
  GetOwnMfaStatusResult,
  StartMfaEnrollmentResult,
} from "./types";

const NOT_FOUND = { success: false as const, error: { code: "auth.users.not_found", message: "Usuário não encontrado." } };
const INVALID_CODE = { success: false as const, error: { code: "auth.mfa.invalid_code", message: "Código inválido. Confira o horário do celular e tente de novo." } };

export async function getOwnMfaStatus(userId: string): Promise<GetOwnMfaStatusResult> {
  const row = await findMfaRow(userId);
  if (!row) return NOT_FOUND;
  const enabled = Boolean(row.mfaSecret);
  return {
    success: true,
    data: { enabled, enabledAt: row.mfaEnabledAt, recoveryCodesLeft: enabled ? await countUnusedRecoveryCodes(userId) : 0 },
  };
}

export async function startMfaEnrollment(userId: string, issuer: string): Promise<StartMfaEnrollmentResult> {
  const row = await findMfaRow(userId);
  if (!row) return NOT_FOUND;
  if (row.mfaSecret) {
    return { success: false, error: { code: "auth.mfa.already_enabled", message: "A verificação em duas etapas já está ativa." } };
  }
  const secret = generateTotpSecret();
  await setPendingSecret(userId, sealSecret(secret));
  return { success: true, data: { secret, otpauthUri: buildOtpauthUri(secret, row.email, issuer) } };
}

export async function confirmMfaEnrollment(userId: string, code: string): Promise<ConfirmMfaEnrollmentResult> {
  const row = await findMfaRow(userId);
  if (!row) return NOT_FOUND;
  const secret = row.mfaPendingSecret ? openSecret(row.mfaPendingSecret) : null;
  if (!secret) {
    return { success: false, error: { code: "auth.mfa.no_enrollment", message: "Comece a ativação de novo." } };
  }
  const step = matchTotp(secret, code);
  if (step === null) return INVALID_CODE;

  const handle = beginOperation({ useCase: "auth.mfa.enable", actor: { id: userId, type: "user" }, kind: "write" });
  const recoveryCodes = generateRecoveryCodes();
  await enableMfa(userId, sealSecret(secret), step, recoveryCodes.map(hashRecoveryCode));
  endOperation(handle, { success: true, summary: `Usuário ${userId} ativou a verificação em duas etapas.` });
  await recordAuditEvent({
    action: "auth.mfa.enabled",
    actor: { id: userId, type: "user" },
    outcome: "success",
    summary: `Verificação em duas etapas ativada (usuário ${userId}).`,
    detail: { userId },
  });
  return { success: true, data: { recoveryCodes } };
}

// Desligar exige um código válido (do app ou de recuperação): sessão aberta sozinha não basta.
export async function disableOwnMfa(userId: string, code: string): Promise<DisableOwnMfaResult> {
  if (!(await verifyMfaCode(userId, code))) return INVALID_CODE;
  await disableMfa(userId);
  await recordAuditEvent({
    action: "auth.mfa.disabled",
    actor: { id: userId, type: "user" },
    outcome: "success",
    summary: `Verificação em duas etapas desativada pelo próprio usuário ${userId}.`,
    detail: { userId },
  });
  return { success: true, data: { disabled: true } };
}
