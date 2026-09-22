import type { OperationResult } from "@/shared/types";

export type DeleteContentTypeCommand = {
  id: string;
  // Tag pra onde os conteúdos que tinham `id` migram — se omitido/null, a exclusão só é permitida
  // quando nenhum conteúdo ficaria sem nenhuma tag (regra de negócio: toda entry tem pelo menos 1).
  reassignToId?: string | null;
  actorId: string;
};
export type DeleteContentTypeInput = Omit<DeleteContentTypeCommand, "actorId">;
export type DeleteContentTypeResult = OperationResult<{ id: string }>;
