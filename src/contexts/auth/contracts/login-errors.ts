import { CredentialsSignin } from "next-auth";
import type { UserRegistrationStatus } from "./types";

// Erro do provider Credentials quando a SENHA ESTÁ CERTA mas a conta não pode entrar. Só é
// lançado depois do verify — nunca revela o status de uma conta a quem não sabe a senha (antes,
// a tela de login consultava o status pelo e-mail sozinho e dizia "conta congelada" pra qualquer
// um). O `code` chega no catch da Server Action de login (signIn lança o próprio erro).
export const BLOCKED_ACCOUNT_CODES = {
  pending: "account_pending",
  rejected: "account_rejected",
  frozen: "account_frozen",
  removed: "account_removed",
} as const satisfies Partial<Record<UserRegistrationStatus, string>>;

export type BlockedAccountCode = (typeof BLOCKED_ACCOUNT_CODES)[keyof typeof BLOCKED_ACCOUNT_CODES];

export class BlockedAccountError extends CredentialsSignin {
  constructor(code: BlockedAccountCode) {
    super();
    this.code = code;
  }
}

export function isBlockedAccountCode(code: unknown): code is BlockedAccountCode {
  return typeof code === "string" && (Object.values(BLOCKED_ACCOUNT_CODES) as string[]).includes(code);
}
