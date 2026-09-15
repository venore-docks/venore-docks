import { beginOperation, endOperation } from "@/observability";
import { insertConnection } from "./store";
import type { CreateConnectionCommand, CreateConnectionResult } from "./types";

export async function createConnection(command: CreateConnectionCommand): Promise<CreateConnectionResult> {
  const handle = beginOperation({
    useCase: "content-feed.create-connection",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const connection = await insertConnection({ name: command.name, categoryIds: command.categoryIds });

  endOperation(handle, { success: true });
  return { success: true, data: connection };
}
