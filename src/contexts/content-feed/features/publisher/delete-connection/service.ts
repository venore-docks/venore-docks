import { beginOperation, endOperation } from "@/observability";
import { deleteConnectionById, findConnectionById } from "./store";
import type { DeleteConnectionCommand, DeleteConnectionResult } from "./types";

export async function deleteConnection(command: DeleteConnectionCommand): Promise<DeleteConnectionResult> {
  const handle = beginOperation({
    useCase: "content-feed.delete-connection",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findConnectionById(command.id);
  if (!existing) {
    const error = { code: "content-feed.connections.not_found", message: `Conexão "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  await deleteConnectionById(command.id);

  endOperation(handle, { success: true });
  return { success: true, data: { id: command.id } };
}
