import { openSecret } from "../../../shared/secret-box";
import { matchTotp } from "../../../shared/totp";
import { hashRecoveryCode, normalizeRecoveryCode } from "../shared/recovery-codes";
import { advanceLastStep, consumeRecoveryCode, findMfaRow } from "../shared/store";

export async function isMfaEnabled(userId: string): Promise<boolean> {
  return Boolean((await findMfaRow(userId))?.mfaSecret);
}

// Código do app (6 dígitos, cada um vale uma vez) ou código de recuperação (uso único).
export async function verifyMfaCode(userId: string, code: string): Promise<boolean> {
  const row = await findMfaRow(userId);
  const secret = row?.mfaSecret ? openSecret(row.mfaSecret) : null;
  if (!secret) return false;

  const trimmed = code.trim();
  const step = matchTotp(secret, trimmed);
  if (step !== null) return advanceLastStep(userId, step);

  if (normalizeRecoveryCode(trimmed).length === 8) {
    return consumeRecoveryCode(userId, hashRecoveryCode(trimmed));
  }
  return false;
}
