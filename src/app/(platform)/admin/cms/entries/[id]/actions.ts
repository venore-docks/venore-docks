"use server";

import { revalidatePath } from "next/cache";
import { applyEntryRevision, discardEntryProposal, getEntry, publishEntry, updateEntry } from "@/contexts/cms";
import { authorizeActor } from "@/contexts/rbac";
import { PREVIEW_ROUTE, PREVIEW_TTL_OPTIONS_HOURS, createPreviewToken } from "@/platform/cms-preview/preview-token";
import { getSiteOrigin } from "@/platform/seo/site-origin";
import { resolveBlockDefinition } from "@/platform/page-builder/block-registry";

export type EditEntryActionState = { error: string | null; notice?: string | null };

const PROPOSAL_NOTICE = "Conteúdo publicado: sua alteração foi enviada como proposta e entra no ar quando um editor aplicar.";

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
  // `speech` (opção "Gerar áudio") vai sempre: o merge de `data` em update-entry é raso, então não
  // toca em data.blocks.
  const data = {
    ...(formData.has("body") ? { body: String(formData.get("body") ?? "") } : {}),
    speech: formData.get("speech") === "on",
  };

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
  return { error: null, notice: result.data.proposalId ? PROPOSAL_NOTICE : null };
}

export async function applyEntryRevisionAction(
  _prevState: EditEntryActionState,
  formData: FormData,
): Promise<EditEntryActionState> {
  const entryId = String(formData.get("entryId") ?? "");
  const result = await applyEntryRevision({ revisionId: String(formData.get("revisionId") ?? "") });
  if (!result.success) {
    return { error: result.error.message };
  }
  revalidatePath("/admin/cms");
  revalidatePath(`/admin/cms/entries/${entryId}`);
  return { error: null, notice: result.data.proposalId ? PROPOSAL_NOTICE : "Versão aplicada." };
}

export async function discardEntryProposalAction(
  _prevState: EditEntryActionState,
  formData: FormData,
): Promise<EditEntryActionState> {
  const entryId = String(formData.get("entryId") ?? "");
  const result = await discardEntryProposal({ revisionId: String(formData.get("revisionId") ?? "") });
  if (!result.success) {
    return { error: result.error.message };
  }
  revalidatePath(`/admin/cms/entries/${entryId}`);
  return { error: null, notice: "Proposta descartada." };
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

export type PreviewLinkState = { error: string | null; url: string | null; expiresAt: string | null };

// Link de pré-visualização (rascunho) pra quem não tem conta. Quem gera precisa poder editar a
// entry — mesmo recorte por categoria do resto do CMS.
export async function createPreviewLinkAction(_prev: PreviewLinkState, formData: FormData): Promise<PreviewLinkState> {
  const entryId = String(formData.get("entryId") ?? "");
  const ttl = Number(formData.get("ttlHours"));
  const ttlHours = (PREVIEW_TTL_OPTIONS_HOURS as readonly number[]).includes(ttl) ? ttl : PREVIEW_TTL_OPTIONS_HOURS[0];

  const entry = entryId ? await getEntry({ id: entryId }) : null;
  if (!entry?.success || !entry.data) {
    return { error: "Conteúdo não encontrado.", url: null, expiresAt: null };
  }
  const authz = await authorizeActor(
    "cms.entries.manage",
    entry.data.categoryId ? { type: "cms.category", resourceId: entry.data.categoryId } : undefined,
  );
  if (!authz.authorized) {
    return { error: authz.error.message, url: null, expiresAt: null };
  }

  const { token, expiresAt } = createPreviewToken(entry.data.id, ttlHours);
  return { error: null, url: `${await getSiteOrigin()}${PREVIEW_ROUTE}/${token}`, expiresAt: expiresAt.toISOString() };
}
