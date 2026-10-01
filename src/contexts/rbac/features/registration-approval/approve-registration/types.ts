import type { OperationResult } from "@/shared/types";

export type ApproveRegistrationInput = {
  userId: string;
  roleId?: string;
  // Sem roleId: papel padrão de cadastro (mesma regra de assign-default-role/types.ts).
  roleKey?: string;
};

export type ApproveRegistrationCommand = ApproveRegistrationInput & { actor: { id: string } };

export type ApproveRegistrationResult = OperationResult<void>;
