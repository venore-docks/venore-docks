import type { OperationResult } from "@/shared/types";

export type PurgeUserCommand = { actorId: string; targetUserId: string };
export type PurgeUserInput = Omit<PurgeUserCommand, "actorId">;
export type PurgeUserResult = OperationResult<{ id: string }>;
