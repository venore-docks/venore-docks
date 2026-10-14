"use server";

import { revalidatePath } from "next/cache";
import { updateEntryComposition, updateEntryLayout, validateComposition, type Composition, type PageLayout } from "@/contexts/cms";
import { resolveBlockDefinition } from "@/platform/page-builder/block-registry";
import { resolveErrorBlockId } from "@/platform/page-builder/composition-tree";

export type SaveCompositionResult =
  // proposed: entry publicada + ator sem permissão de publicar — a composição virou proposta
  // pendente de revisão (nada mudou no site ainda).
  | { success: true; proposed: boolean }
  | { success: false; error: { code: string; message: string; blockId: string | null } };

// A validação roda aqui (fora do handler) só pra recuperar o `path` do erro — o handler devolve
// {code, message} (formato fixo de OperationResult), sem path; validateComposition roda de novo
// dentro dele, então isso é redundante mas barato, e é o único jeito de destacar o bloco culpado
// em vez de um toast genérico (pedido da sessão).
export async function saveEntryCompositionAction(entryId: string, composition: Composition): Promise<SaveCompositionResult> {
  const validation = validateComposition(composition, resolveBlockDefinition);
  if (!validation.valid) {
    const [first] = validation.errors;
    return {
      success: false,
      error: { code: first.code, message: first.message, blockId: resolveErrorBlockId(composition, first.path) },
    };
  }

  const result = await updateEntryComposition({ id: entryId, composition, resolveDefinition: resolveBlockDefinition });
  if (!result.success) {
    return { success: false, error: { ...result.error, blockId: null } };
  }

  revalidatePath("/admin/cms");
  revalidatePath(`/admin/cms/entries/${entryId}`);
  revalidatePath(`/admin/cms/entries/${entryId}/builder`);
  return { success: true, proposed: result.data.proposalId !== null };
}

export type SaveEntryLayoutResult = { success: true; proposed: boolean; layout: PageLayout } | { success: false; error: { code: string; message: string } };

// Layout da página (v8, spec §7.15). Autorização (cms.entries.manage + escopo por categoria) e o
// fluxo de proposta ficam no use case — a action só repassa e revalida.
export async function saveEntryLayoutAction(entryId: string, layout: PageLayout): Promise<SaveEntryLayoutResult> {
  const result = await updateEntryLayout({ entryId, layout });
  if (!result.success) return { success: false, error: result.error };

  revalidatePath(`/admin/cms/entries/${entryId}/builder`);
  if (!result.data.proposed) revalidatePath("/", "layout");
  return { success: true, proposed: result.data.proposed, layout: result.data.layout };
}
