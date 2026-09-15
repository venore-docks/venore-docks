import type { OperationResult } from "@/shared/types";

export type RejectRegistrationInput = {
  userId: string;
  reason?: string;
};

export type RejectRegistrationCommand = RejectRegistrationInput & { actor: { id: string } };

export type RejectRegistrationResult = OperationResult<void>;
