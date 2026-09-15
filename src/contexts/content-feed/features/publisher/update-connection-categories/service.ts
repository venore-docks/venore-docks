import { beginOperation, endOperation } from "@/observability";
import { applyConnectionCategories, findConnectionById } from "./store";
import type { UpdateConnectionCategoriesCommand, UpdateConnectionCategoriesResult } from "./types";

export async function updateConnectionCategories(
  command: UpdateConnectionCategoriesCommand,
): Promise<UpdateConnectionCategoriesResult> {
  const handle = beginOperation({
    useCase: "content-feed.update-connection-categories",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findConnectionById(command.id);
  if (!existing) {
    const error = { code: "content-feed.connections.not_found", message: `Conexão "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const connection = await applyConnectionCategories(command.id, command.categoryIds);

  endOperation(handle, { success: true });
  return { success: true, data: connection };
}
