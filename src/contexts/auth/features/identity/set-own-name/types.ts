import type { OperationResult } from "@/shared/types";

export type SetOwnNameCommand = { actorId: string; name: string };
export type SetOwnNameInput = Omit<SetOwnNameCommand, "actorId">;
export type SetOwnNameResult = OperationResult<{ id: string }>;
