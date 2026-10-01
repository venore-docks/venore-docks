import type { OperationResult } from "@/shared/types";

export type OwnAuthoredEntry = { id: string; title: string; slug: string; status: string; createdAt: Date; updatedAt: Date };
export type ListOwnAuthoredEntriesResult = OperationResult<OwnAuthoredEntry[]>;
