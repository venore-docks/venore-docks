import type { OperationResult } from "@/shared/types";

export type ActivateUserCommand = { userId: string; reason: "registration-auto-approval" | "bootstrap" };

export type ActivateUserResult = OperationResult<void>;
