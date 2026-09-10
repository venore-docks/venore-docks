import { authorizeActor } from "@/contexts/rbac";
import { deleteConnection } from "./service";
import type { DeleteConnectionInput, DeleteConnectionResult } from "./types";

export async function deleteConnectionHandler(input: DeleteConnectionInput): Promise<DeleteConnectionResult> {
  if (input.id.trim().length === 0) {
    return { success: false, error: { code: "content-feed.connections.invalid_id", message: "id da conexão não pode ser vazio." } };
  }

  const authz = await authorizeActor("content-feed.connections.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return deleteConnection({ ...input, actorId: authz.actorId });
}
