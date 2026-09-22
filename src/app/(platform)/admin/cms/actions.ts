"use server";

import { revalidatePath } from "next/cache";
import { archiveEntry, createCategory, createContentType, deleteEntry, publishEntry, scheduleEntry } from "@/contexts/cms";
import { resolveBlockDefinition } from "@/platform/page-builder/block-registry";

export type CmsActionState = { error: string | null };

// Toda ação de escrita do CMS devolve o erro de verdade do handler via useActionState, em vez de
// descartá-lo silenciosamente (docs/venore-docks.md — mesmo conserto do bug do superadmin em
// /admin/rbac/actions.ts: removeRoleAction).
export async function createContentTypeAction(
  _prevState: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const result = await createContentType({
    key: String(formData.get("key") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  // Content types (tags) aparecem em três telas além de /admin/cms: a listagem própria, o form de
  // criação e o de edição de entry (checkbox de tags em ambos) — revalidar só /admin/cms deixava
  // as outras com a versão em cache até a próxima navegação "fria".
  revalidatePath("/admin/cms");
  revalidatePath("/admin/cms/content-types");
  revalidatePath("/admin/cms/entries");
  revalidatePath("/admin/cms/entries/new");
  revalidatePath("/admin/cms/entries/[id]", "page");
  return { error: null };
}

export async function createCategoryAction(_prevState: CmsActionState, formData: FormData): Promise<CmsActionState> {
  const result = await createCategory({
    key: String(formData.get("key") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  return { error: null };
}

export async function publishEntryAction(_prevState: CmsActionState, formData: FormData): Promise<CmsActionState> {
  const result = await publishEntry({ id: String(formData.get("id") ?? ""), resolveDefinition: resolveBlockDefinition });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  return { error: null };
}

export async function scheduleEntryAction(_prevState: CmsActionState, formData: FormData): Promise<CmsActionState> {
  const scheduledPublishAtRaw = String(formData.get("scheduledPublishAt") ?? "");
  const scheduledArchiveAtRaw = String(formData.get("scheduledArchiveAt") ?? "").trim();

  const result = await scheduleEntry({
    id: String(formData.get("id") ?? ""),
    scheduledPublishAt: new Date(scheduledPublishAtRaw),
    scheduledArchiveAt: scheduledArchiveAtRaw ? new Date(scheduledArchiveAtRaw) : undefined,
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  return { error: null };
}

export async function archiveEntryAction(_prevState: CmsActionState, formData: FormData): Promise<CmsActionState> {
  const result = await archiveEntry({ id: String(formData.get("id") ?? "") });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  return { error: null };
}

export async function deleteEntryAction(_prevState: CmsActionState, formData: FormData): Promise<CmsActionState> {
  const result = await deleteEntry({ id: String(formData.get("id") ?? "") });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms");
  return { error: null };
}
