import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RECOVERY_CODE_COUNT = 8;

function randomCode(): string {
  const bytes = randomBytes(8);
  const chars = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, randomCode);
}

export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`mfa-recovery:${normalizeRecoveryCode(code)}`).digest("hex");
}
