import { beginOperation, endOperation } from "@/observability";
import { ENTRY_LAYOUT_DATA_KEY, parsePageLayout } from "../../../contracts/page-layout";
import { canPublishInCategory, isLive, recordProposal, recordSnapshot, stateOf } from "../../../shared/entry-revisions";
import { assertCmsCategoryScope } from "../../../shared/scoped-authorization";
import { findEntryById, saveEntryData } from "./store";
import type { UpdateEntryLayoutCommand, UpdateEntryLayoutResult } from "./types";

// Layout por página (spec v8 §4.5/§7.15): troca SÓ data.layout, preservando o resto de data
// (blocks, body…). Layout vazio remove a chave (a página volta a herdar seção/tema). Mesmas regras
// de escrita de update-entry-composition: escopo por categoria (Fase C) e, com a entry no ar e um
// ator que não pode publicar na categoria dela, a mudança vira proposta (revisões).
export async function updateEntryLayout(command: UpdateEntryLayoutCommand): Promise<UpdateEntryLayoutResult> {
  const handle = beginOperation({ useCase: "cms.update-entry-layout", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (error: { code: string; message: string }): UpdateEntryLayoutResult => {
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const parsed = parsePageLayout(command.layout);
  if (!parsed.success) {
    return fail({ code: "cms.entries.invalid_layout", message: `Layout de página inválido (campo "${parsed.field}").` });
  }
  const layout = parsed.data;

  const existing = await findEntryById(command.entryId);
  if (!existing) return fail({ code: "cms.entries.not_found", message: `Entry "${command.entryId}" não encontrada.` });

  const scope = await assertCmsCategoryScope(command.actorId, ["cms.entries.manage"], existing.categoryId);
  if (!scope.success) return fail(scope.error);

  const existingData = existing.data && typeof existing.data === "object" ? (existing.data as Record<string, unknown>) : {};
  const { [ENTRY_LAYOUT_DATA_KEY]: _previous, ...rest } = existingData;
  void _previous;
  const nextData: Record<string, unknown> = Object.keys(layout).length > 0 ? { ...rest, [ENTRY_LAYOUT_DATA_KEY]: layout } : rest;

  if (isLive(existing) && !(await canPublishInCategory(command.actorId, existing.categoryId))) {
    await recordProposal(existing.id, { ...stateOf(existing), contentTypeIds: null, data: nextData }, command.actorId);
    endOperation(handle, {
      success: true,
      summary: `user:${command.actorId} propôs um novo layout para a entry publicada "${existing.title}" (aguardando revisão).`,
    });
    return { success: true, data: { entryId: existing.id, layout, proposed: true } };
  }

  await recordSnapshot({ ...existing, contentTypeIds: existing.contentTypeIds ?? [] }, command.actorId);
  await saveEntryData(existing.id, nextData);
  endOperation(handle, { success: true });
  return { success: true, data: { entryId: existing.id, layout, proposed: false } };
}
