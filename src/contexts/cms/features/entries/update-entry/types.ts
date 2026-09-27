import type { OperationResult } from "@/shared/types";
import type { EntryRecord, EntryVisibility } from "../../../contracts/types";

export type UpdateEntryCommand = {
  id: string;
  title?: string;
  slug?: string;
  categoryId?: string | null;
  contentTypeIds?: string[];
  visibility?: EntryVisibility;
  // Agendar (só) o arquivamento de uma entry já publicada — diferente de schedule-entry, que
  // agenda a PUBLICAÇÃO e força status "scheduled" (Fase 2/C5). null limpa o agendamento.
  scheduledArchiveAt?: Date | null;
  data?: unknown;
  mediaId?: string | null;
  actorId: string;
};
export type UpdateEntryInput = Omit<UpdateEntryCommand, "actorId">;
// proposalId != null: a entry estava publicada e o ator não pode publicar — a alteração virou
// uma PROPOSTA pendente (shared/entry-revisions) e a entry devolvida é a atual, inalterada.
export type UpdateEntryResult = OperationResult<EntryRecord & { proposalId: string | null }>;
