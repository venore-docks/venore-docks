import type { OperationResult } from "@/shared/types";

export type FreezeUserCommand = { actorId: string; targetUserId: string; reason?: string };
export type FreezeUserInput = Omit<FreezeUserCommand, "actorId">;
export type FreezeUserResult = OperationResult<{ id: string }>;
