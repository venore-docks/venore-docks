import type { OperationResult } from "@/shared/types";

export type DeleteConnectionInput = { id: string };
export type DeleteConnectionCommand = DeleteConnectionInput & { actorId: string };
export type DeleteConnectionResult = OperationResult<{ id: string }>;
