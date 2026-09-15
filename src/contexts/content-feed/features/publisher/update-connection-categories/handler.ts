import { authorizeActor } from "@/contexts/rbac";
import { updateConnectionCategories } from "./service";
import type { UpdateConnectionCategoriesInput, UpdateConnectionCategoriesResult } from "./types";

export async function updateConnectionCategoriesHandler(
  input: UpdateConnectionCategoriesInput,
): Promise<UpdateConnectionCategoriesResult> {
  if (input.id.trim().length === 0) {
    return { success: false, error: { code: "content-feed.connections.invalid_id", message: "id da conexão não pode ser vazio." } };
  }

  const authz = await authorizeActor("content-feed.connections.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return updateConnectionCategories({ ...input, actorId: authz.actorId });
}
