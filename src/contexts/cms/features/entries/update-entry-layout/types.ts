import type { OperationResult } from "@/shared/types";
import type { PageLayout } from "../../../contracts/page-layout";

export type UpdateEntryLayoutInput = { entryId: string; layout: PageLayout };
export type UpdateEntryLayoutCommand = UpdateEntryLayoutInput & { actorId: string };
// proposed: true quando a entry está publicada, o ator não pode publicar na categoria dela e a
// mudança virou proposta pendente (fluxo de proposta — nada muda no site até alguém aplicar).
export type UpdateEntryLayoutResult = OperationResult<{ entryId: string; layout: PageLayout; proposed: boolean }>;
