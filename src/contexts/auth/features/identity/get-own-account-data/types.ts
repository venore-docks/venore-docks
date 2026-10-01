import type { OperationResult } from "@/shared/types";

// Dados pessoais que o core guarda sobre a conta — base do "baixar meus dados" (LGPD, art. 18).
export type OwnAccountData = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  avatarMediaId: string | null;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  linkedProviders: string[];
};
export type GetOwnAccountDataResult = OperationResult<OwnAccountData>;
