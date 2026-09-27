import type { OperationResult } from "@/shared/types";

export type DiscardEntryProposalInput = { revisionId: string };
export type DiscardEntryProposalCommand = DiscardEntryProposalInput & { actorId: string };
export type DiscardEntryProposalResult = OperationResult<void>;
