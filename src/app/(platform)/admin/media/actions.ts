"use server";

import { revalidatePath } from "next/cache";
import {
  clearCategoryAssets,
  confirmMediaUpload,
  createCategory,
  deleteCategory,
  requestMediaUploadTicket,
  updateCategory,
  updateMediaAssetCategory,
  updateMediaAssetVisibility,
  uploadMediaAsset,
  type MediaVisibility,
  type RequestMediaUploadTicketResult,
} from "@/contexts/media";
import { deleteMediaSafely } from "@/platform/media-lifecycle/delete-media-safely";
import { collectMediaUsage } from "@/platform/media-usage/media-usage-registry";
import type { MediaUsageReference } from "@/platform/media-usage/types";
import type { MediaAsset } from "@/contexts/media/contracts/types";
import type { OperationResult } from "@/shared/types";

export type MediaActionState = { error: string | null };

function parseVisibility(value: FormDataEntryValue | null): MediaVisibility {
  return value === "public" || value === "restricted" ? value : "private";
}

// Mesmo padrão de removeRoleAction (/admin/rbac/actions.ts): erro do handler é devolvido de
// verdade via useActionState, nunca descartado silenciosamente (docs/venore-docks.md).
export async function uploadMediaAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo para enviar." };
  }

  const data = Buffer.from(await file.arrayBuffer());
  const visibility = parseVisibility(formData.get("visibility"));

  const result = await uploadMediaAsset({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    data,
    visibility,
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  return { error: null };
}

// Par de actions do fluxo de client-upload direto ao Blob (docs/media/blob-spec.md) — necessário
// porque uploadMediaAction acima (server-buffered) nunca tinha um teto de tamanho no client: o
// form de /admin/media deixava escolher qualquer arquivo dentro do limite de MEDIA_ALLOWED_TYPES
// (vídeo até 200MB) e sempre tentava o caminho buffered, que esbarra no limite de body de uma
// serverless function da Vercel (4.5MB, hardcoded pela plataforma, não configurável por
// next.config.ts) bem antes do limite de negócio — o upload falhava sem chegar a rodar código da
// aplicação, então nenhum toast de erro aparecia ("nada acontece"). UploadMediaForm passa a usar
// este par acima de SERVER_BUFFERED_MAX_BYTES, mesmo padrão já usado por MediaPickerField.
export async function requestMediaUploadTicketAction(input: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<RequestMediaUploadTicketResult> {
  return requestMediaUploadTicket(input);
}

export async function confirmMediaUploadAction(input: {
  filename: string;
  pathname: string;
  url: string;
  contentType: string;
  size: number;
  checksum: string;
  visibility: MediaVisibility;
}): Promise<OperationResult<MediaAsset>> {
  const result = await confirmMediaUpload(input);
  if (result.success) {
    revalidatePath("/admin/media");
  }
  return result;
}

// Consultada pelo client antes de pedir confirmação de exclusão (docs do pedido: "a deleção
// avisa quantos locais serão afetados e exige confirmação") — leitura pura, sem apagar nada.
export async function getMediaUsageSummaryAction(id: string): Promise<MediaUsageReference[]> {
  return collectMediaUsage(id);
}

// Exclusão passa por platform/media-lifecycle/delete-media-safely.ts, não por
// contexts/media.deleteMediaAsset direto — é o ponto de composição que já checa uso em cms/brand/
// academy antes de apagar (docs/venore-docks.md, regra 12/14). `confirmed` chega como "true"
// depois que o usuário já viu a contagem de locais afetados (getMediaUsageSummaryAction) e
// confirmou no client — sem isso, deleteMediaSafely recusa apagar mídia em uso.
export async function deleteMediaAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const id = String(formData.get("id") ?? "");
  const confirmed = formData.get("confirmed") === "true";
  const result = await deleteMediaSafely({ id, confirmed });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  revalidatePath(`/admin/media/${id}`);
  return { error: null };
}

export async function updateMediaVisibilityAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const id = String(formData.get("id") ?? "");
  const visibility = parseVisibility(formData.get("visibility"));

  const result = await updateMediaAssetVisibility({ id, visibility });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  revalidatePath(`/admin/media/${id}`);
  return { error: null };
}

export async function updateMediaCategoryAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const id = String(formData.get("id") ?? "");
  const rawCategoryId = String(formData.get("categoryId") ?? "");
  const categoryId = rawCategoryId.length === 0 ? null : rawCategoryId;

  const result = await updateMediaAssetCategory({ id, categoryId });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  revalidatePath(`/admin/media/${id}`);
  return { error: null };
}

export async function createCategoryAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const name = String(formData.get("name") ?? "");
  const result = await createCategory({ name });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  return { error: null };
}

export async function renameCategoryAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const result = await updateCategory({ id, name });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  return { error: null };
}

// Duas etapas deliberadas (docs do pedido: "categoria em uso não é apagada sem tratar os assets
// vinculados"): esta action tenta apagar direto; se a categoria estiver em uso, o erro devolvido
// tem o código media.categories.in_use, e o client oferece "remover categoria de N arquivos"
// (clearCategoryAssetsAction) antes de deixar tentar apagar de novo — nunca cascata automática.
export async function deleteCategoryAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const id = String(formData.get("id") ?? "");
  const result = await deleteCategory({ id });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  return { error: null };
}

export async function clearCategoryAssetsAction(
  _prevState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const categoryId = String(formData.get("categoryId") ?? "");
  const result = await clearCategoryAssets({ categoryId });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/media");
  return { error: null };
}
