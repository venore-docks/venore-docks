import { authorizeActor } from "@/contexts/rbac";
import { deleteSource } from "./service";
import type { DeleteSourceInput, DeleteSourceResult } from "./types";

export async function deleteSourceHandler(input: DeleteSourceInput): Promise<DeleteSourceResult> {
  if (input.id.trim().length === 0) {
    return { success: false, error: { code: "content-feed.sources.invalid_id", message: "id da fonte não pode ser vazio." } };
  }

  const authz = await authorizeActor("content-feed.sources.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return deleteSource({ ...input, actorId: authz.actorId });
}
