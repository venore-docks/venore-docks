import { beginOperation, endOperation } from "@/observability";
import { deleteSourceById, findSourceById } from "./store";
import type { DeleteSourceCommand, DeleteSourceResult } from "./types";

export async function deleteSource(command: DeleteSourceCommand): Promise<DeleteSourceResult> {
  const handle = beginOperation({
    useCase: "content-feed.delete-source",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findSourceById(command.id);
  if (!existing) {
    const error = { code: "content-feed.sources.not_found", message: `Fonte "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  await deleteSourceById(command.id);

  endOperation(handle, { success: true });
  return { success: true, data: { id: command.id } };
}
