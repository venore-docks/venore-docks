import type { OperationResult } from "@/shared/types";

export type DeleteSourceInput = { id: string };
export type DeleteSourceCommand = DeleteSourceInput & { actorId: string };
export type DeleteSourceResult = OperationResult<{ id: string }>;
