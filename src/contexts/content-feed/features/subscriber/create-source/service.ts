import { beginOperation, endOperation } from "@/observability";
import { insertSource } from "./store";
import type { CreateSourceCommand, CreateSourceResult } from "./types";

export async function createSource(command: CreateSourceCommand): Promise<CreateSourceResult> {
  const handle = beginOperation({
    useCase: "content-feed.create-source",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const source = await insertSource({
    name: command.name,
    remoteUrl: command.remoteUrl,
    connectionKey: command.connectionKey,
    categoryKeys: command.categoryKeys,
  });

  endOperation(handle, { success: true });
  return { success: true, data: source };
}
