import { authorizeActor } from "@/contexts/rbac";
import { deleteContentType } from "./service";
import type { DeleteContentTypeInput, DeleteContentTypeResult } from "./types";

export async function deleteContentTypeHandler(input: DeleteContentTypeInput): Promise<DeleteContentTypeResult> {
  if (input.id.trim().length === 0) {
    return { success: false, error: { code: "cms.content-types.invalid_id", message: "id da tag não pode ser vazio." } };
  }

  const authz = await authorizeActor("cms.content-types.manage");
  if (!authz.authorized) {
    return { success: false, error: authz.error };
  }

  return deleteContentType({ ...input, actorId: authz.actorId });
}
