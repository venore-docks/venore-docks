import type { OperationResult } from "@/shared/types";

export type RemoveUserCommand = { actorId: string; targetUserId: string; reason?: string };
export type RemoveUserInput = Omit<RemoveUserCommand, "actorId">;
export type RemoveUserResult = OperationResult<{ id: string }>;
