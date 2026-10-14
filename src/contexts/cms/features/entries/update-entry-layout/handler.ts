import { authorizeActor } from "@/contexts/rbac";
import { parsePageLayout } from "../../../contracts/page-layout";
import { updateEntryLayout } from "./service";
import type { UpdateEntryLayoutInput, UpdateEntryLayoutResult } from "./types";

// Borda: valida o formato do layout e faz o gate de seção (cms.entries.manage). O recorte por
// categoria (escopo) e o fluxo de proposta ficam no service, que recebe o actorId explícito.
export async function updateEntryLayoutHandler(input: UpdateEntryLayoutInput): Promise<UpdateEntryLayoutResult> {
  if (typeof input?.entryId !== "string" || input.entryId.trim().length === 0) {
    return { success: false, error: { code: "cms.entries.invalid_id", message: "entryId não pode ser vazio." } };
  }
  const parsed = parsePageLayout(input.layout);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "cms.entries.invalid_layout", message: `Layout de página inválido (campo "${parsed.field}").` },
    };
  }

  const authz = await authorizeActor("cms.entries.manage");
  if (!authz.authorized) return { success: false, error: authz.error };

  return updateEntryLayout({ entryId: input.entryId, layout: parsed.data, actorId: authz.actorId });
}
