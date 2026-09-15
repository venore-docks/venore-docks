import { beginOperation, endOperation } from "@/observability";
import { applySourceUpdate, findSourceById } from "./store";
import type { UpdateSourceCommand, UpdateSourceResult } from "./types";

export async function updateSource(command: UpdateSourceCommand): Promise<UpdateSourceResult> {
  const handle = beginOperation({
    useCase: "content-feed.update-source",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findSourceById(command.id);
  if (!existing) {
    const error = { code: "content-feed.sources.not_found", message: `Fonte "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const source = await applySourceUpdate(command.id, {
    name: command.name,
    remoteUrl: command.remoteUrl,
    connectionKey: command.connectionKey,
    categoryKeys: command.categoryKeys,
  });

  endOperation(handle, { success: true });
  return { success: true, data: source };
}
