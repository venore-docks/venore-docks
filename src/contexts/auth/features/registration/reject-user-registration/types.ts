import type { OperationResult } from "@/shared/types";

export type RejectUserRegistrationInput = {
  userId: string;
};

export type RejectUserRegistrationResult = OperationResult<void>;
