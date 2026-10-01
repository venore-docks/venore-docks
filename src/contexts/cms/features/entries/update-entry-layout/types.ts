import type { OperationResult } from "@/shared/types";
import type { PageLayout } from "../../../contracts/page-layout";

export type UpdateEntryLayoutInput = { entryId: string; layout: PageLayout };
// proposed: true quando a entry está publicada e a mudança virou proposta (fluxo de proposta).
export type UpdateEntryLayoutResult = OperationResult<{ entryId: string; layout: PageLayout; proposed: boolean }>;
