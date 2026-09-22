import { beginOperation, endOperation } from "@/observability";
import { invalidateCache } from "../../../../../infrastructure/cache/memory-cache";
import { findContentTypeById, findExclusivelyTaggedEntryIds, removeContentType } from "./store";
import type { DeleteContentTypeCommand, DeleteContentTypeResult } from "./types";

export async function deleteContentType(command: DeleteContentTypeCommand): Promise<DeleteContentTypeResult> {
  const handle = beginOperation({
    useCase: "cms.delete-content-type",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const contentType = await findContentTypeById(command.id);
  if (!contentType) {
    const error = { code: "cms.content-types.not_found", message: `Tag "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const reassignToId = command.reassignToId ?? null;

  if (reassignToId) {
    if (reassignToId === command.id) {
      const error = {
        code: "cms.content-types.invalid_reassignment",
        message: "A tag de destino precisa ser diferente da tag sendo apagada.",
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }

    const target = await findContentTypeById(reassignToId);
    if (!target) {
      const error = {
        code: "cms.content-types.reassignment_target_not_found",
        message: `Tag de destino "${reassignToId}" não encontrada.`,
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  } else {
    // Sem reatribuição: só permite apagar se nenhuma entry ficar sem tag nenhuma — regra de
    // negócio fixa (create-entry/update-entry já exigem pelo menos 1 tag na escrita), aqui
    // reforçada na exclusão pra não deixar dado existente violá-la por trás.
    const orphanEntryIds = await findExclusivelyTaggedEntryIds(command.id);
    if (orphanEntryIds.length > 0) {
      const error = {
        code: "cms.content-types.would_orphan_entries",
        message: `${orphanEntryIds.length} conteúdo(s) ficariam sem nenhuma tag. Escolha uma tag de destino para reatribuí-los antes de apagar.`,
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  }

  await removeContentType(command.id, reassignToId);

  invalidateCache("cms:content-types");

  endOperation(handle, { success: true });
  return { success: true, data: { id: command.id } };
}
