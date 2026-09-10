import { authorizeActor } from "@/contexts/rbac";
import { createConnection } from "./service";
import type { CreateConnectionInput, CreateConnectionResult } from "./types";

export async function createConnectionHandler(input: CreateConnectionInput): Promise<CreateConnectionResult> {
  if (input.name.trim().length === 0) {
    return {
      success: false,
      error: { code: "content-feed.connections.invalid_name", message: "O nome da conexão não pode ser vazio." },
    };
  }

  const authz = await authorizeActor("content-feed.connections.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return createConnection({ ...input, actorId: authz.actorId });
}
