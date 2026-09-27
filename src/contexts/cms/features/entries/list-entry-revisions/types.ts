import type { OperationResult } from "@/shared/types";
import type { EntryRevisionSummary } from "../../../contracts/types";

export type ListEntryRevisionsInput = { entryId: string };
export type ListEntryRevisionsCommand = ListEntryRevisionsInput & { actorId: string };
export type ListEntryRevisionsResult = OperationResult<{ revisions: EntryRevisionSummary[]; canPublish: boolean }>;
