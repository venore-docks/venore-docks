"use server";

import { revalidatePath } from "next/cache";
import {
  createConnection,
  createSource,
  deleteConnection,
  deleteSource,
  syncSource,
  updateConnectionCategories,
} from "@/contexts/content-feed";

export type ContentFeedActionState = { error: string | null };

function parseCategoryKeys(raw: string): string[] {
  return raw
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

export async function createConnectionAction(
  _prevState: ContentFeedActionState,
  formData: FormData,
): Promise<ContentFeedActionState> {
  const result = await createConnection({
    name: String(formData.get("name") ?? ""),
    categoryIds: formData.getAll("categoryIds").map(String),
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/content-feed");
  return { error: null };
}

export async function updateConnectionCategoriesAction(
  _prevState: ContentFeedActionState,
  formData: FormData,
): Promise<ContentFeedActionState> {
  const result = await updateConnectionCategories({
    id: String(formData.get("id") ?? ""),
    categoryIds: formData.getAll("categoryIds").map(String),
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/content-feed");
  return { error: null };
}

export async function deleteConnectionAction(
  _prevState: ContentFeedActionState,
  formData: FormData,
): Promise<ContentFeedActionState> {
  const result = await deleteConnection({ id: String(formData.get("id") ?? "") });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/content-feed");
  return { error: null };
}

export async function createSourceAction(
  _prevState: ContentFeedActionState,
  formData: FormData,
): Promise<ContentFeedActionState> {
  const result = await createSource({
    name: String(formData.get("name") ?? ""),
    remoteUrl: String(formData.get("remoteUrl") ?? ""),
    connectionKey: String(formData.get("connectionKey") ?? ""),
    categoryKeys: parseCategoryKeys(String(formData.get("categoryKeys") ?? "")),
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/content-feed");
  return { error: null };
}

export async function deleteSourceAction(
  _prevState: ContentFeedActionState,
  formData: FormData,
): Promise<ContentFeedActionState> {
  const result = await deleteSource({ id: String(formData.get("id") ?? "") });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/content-feed");
  return { error: null };
}

export async function syncSourceAction(
  _prevState: ContentFeedActionState,
  formData: FormData,
): Promise<ContentFeedActionState> {
  const result = await syncSource({ id: String(formData.get("id") ?? "") });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/content-feed");
  return { error: result.data.error };
}
