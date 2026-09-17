"use server";

import { revalidatePath } from "next/cache";
import { publishEntry, updateEntry } from "@/contexts/cms";
import { resolveBlockDefinition } from "@/platform/page-builder/block-registry";

export type EditEntryActionState = { error: string | null };

// Mesmo padrão de removeRoleAction (/admin/rbac/actions.ts): erro do handler é devolvido de
// verdade via useActionState, nunca descartado silenciosamente (docs/venore-docks.md).
export async function updateEntryAction(
  _prevState: EditEntryActionState,
  formData: FormData,
): Promise<EditEntryActionState> {
  const id = String(formData.get("id") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const visibility = formData.get("visibility") === "authenticated" ? "authenticated" : "public";

  // O campo "Corpo" some do form assim que a entry já tem composição do Editor Visual
  // (ver hasComposition em edit-entry-form.tsx) — nesse caso formData não tem "body" e esta tela
  // não deve mandar nenhum patch de `data`, senão apagaria data.blocks.
  const data = formData.has("body") ? { body: String(formData.get("body") ?? "") } : undefined;

  const result = await updateEntry({
    id,
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    categoryId: categoryId || null,
    contentTypeIds: formData.getAll("contentTypeIds").map(String),
    visibility,
    data,
    mediaId: mediaId || null,
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  revalidatePath(`/admin/cms/entries/${id}`);
  return { error: null };
}

export async function publishEntryFromEditAction(
  _prevState: EditEntryActionState,
  formData: FormData,
): Promise<EditEntryActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await publishEntry({ id, resolveDefinition: resolveBlockDefinition });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  revalidatePath(`/admin/cms/entries/${id}`);
  return { error: null };
}
