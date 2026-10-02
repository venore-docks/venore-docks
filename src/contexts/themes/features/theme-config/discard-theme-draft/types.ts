import type { OperationResult } from "@/shared/types";

export type DiscardThemeDraftCommand = { actorId: string };
// discarded false = não havia rascunho (idempotente).
export type DiscardThemeDraftResult = OperationResult<{ discarded: boolean }>;
