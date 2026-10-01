import type { OperationResult } from "@/shared/types";

export type ResetPasswordWithTokenInput = { token: string; newPassword: string };
export type ResetPasswordWithTokenResult = OperationResult<{ userId: string }>;
