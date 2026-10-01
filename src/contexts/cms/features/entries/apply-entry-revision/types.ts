import type { OperationResult } from "@/shared/types";

export type ApplyEntryRevisionInput = { revisionId: string };
export type ApplyEntryRevisionCommand = ApplyEntryRevisionInput & { actorId: string };
// applied: a entry mudou. proposalId: restaurar um snapshot de entry publicada sem poder publicar
// virou uma nova proposta (nada mudou no ar).
export type ApplyEntryRevisionResult = OperationResult<{ applied: boolean; proposalId: string | null }>;
