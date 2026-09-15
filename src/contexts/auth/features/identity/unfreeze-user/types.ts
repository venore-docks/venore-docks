import type { OperationResult } from "@/shared/types";

export type UnfreezeUserCommand = { actorId: string; targetUserId: string };
export type UnfreezeUserInput = Omit<UnfreezeUserCommand, "actorId">;
export type UnfreezeUserResult = OperationResult<{ id: string }>;
