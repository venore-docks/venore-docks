import type { OperationResult } from "@/shared/types";

export type RevokeUserSessionsInput = { targetUserId: string };
export type RevokeSessionsCommand = { userId: string; actorId: string; reason: "self" | "admin" | "password-changed" };
export type RevokeSessionsResult = OperationResult<{ sessionVersion: number }>;
