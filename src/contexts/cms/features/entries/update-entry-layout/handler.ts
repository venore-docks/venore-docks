import { authorizeActor } from "@/contexts/rbac";
import { updateEntryLayout } from "./service";
import type { UpdateEntryLayoutInput, UpdateEntryLayoutResult } from "./types";

// Dono: W5 (autorização com escopo por categoria via contexts/cms/shared/scoped-authorization).
export async function updateEntryLayoutHandler(input: UpdateEntryLayoutInput): Promise<UpdateEntryLayoutResult> {
  if (typeof input?.entryId !== "string" || input.entryId.length === 0 || typeof input.layout !== "object" || input.layout === null) {
    return { success: false, error: { code: "cms.entries.invalid_layout", message: "entryId e layout são obrigatórios." } };
  }
  const authz = await authorizeActor("cms.entries.manage");
  if (!authz.authorized) return { success: false, error: authz.error };
  return updateEntryLayout(input);
}
