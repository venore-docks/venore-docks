import type { OperationResult } from "@/shared/types";

export type SyncSourceInput = { id: string };
export type SyncSourceCommand = SyncSourceInput & { actorId: string };
export type SyncSourceResult = OperationResult<{ syncedCount: number; error: string | null }>;
