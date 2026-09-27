import type { OperationResult } from "@/shared/types";
import type { Block } from "../../../contracts/block";
import type { ResolveBlockDefinition } from "../../../contracts/block-definition";
import type { EntryRecord } from "../../../contracts/types";

export type UpdateEntryCompositionCommand = {
  id: string;
  composition: Block[];
  resolveDefinition: ResolveBlockDefinition;
  actorId: string;
};
export type UpdateEntryCompositionInput = Omit<UpdateEntryCompositionCommand, "actorId">;
// proposalId != null: entry publicada + ator sem permissão de publicar — a composição virou
// proposta pendente e a entry devolvida é a atual, inalterada (ver update-entry/types.ts).
export type UpdateEntryCompositionResult = OperationResult<EntryRecord & { proposalId: string | null }>;
