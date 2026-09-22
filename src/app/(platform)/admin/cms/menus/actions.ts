"use server";

import { revalidatePath } from "next/cache";
import {
  createMenu,
  createMenuItem,
  deleteMenu,
  listEntriesForAdmin,
  moveMenuItem,
  removeMenuItem,
  updateMenuItem,
} from "@/contexts/cms";
import type { EntryStatus, MenuItemTarget, MenuLocation } from "@/contexts/cms";

export type MenuActionState = { error: string | null };

function targetFromFormData(formData: FormData): MenuItemTarget | null {
  const targetType = String(formData.get("targetType") ?? "");

  if (targetType === "content") {
    const contentId = String(formData.get("contentId") ?? "").trim();
    const anchor = String(formData.get("anchor") ?? "").trim();
    return contentId ? { targetType: "content", contentId, anchor: anchor || null } : null;
  }

  if (targetType === "route") {
    const routePath = String(formData.get("routePath") ?? "").trim();
    if (!routePath) return null;
    const requiredPermissionKey = String(formData.get("requiredPermissionKey") ?? "").trim();
    return { targetType: "route", routePath, requiredPermissionKey: requiredPermissionKey || null };
  }

  if (targetType === "external") {
    const externalUrl = String(formData.get("externalUrl") ?? "").trim();
    return externalUrl ? { targetType: "external", externalUrl } : null;
  }

  if (targetType === "label") {
    return { targetType: "label" };
  }

  return null;
}

export async function createMenuAction(_prevState: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const location = String(formData.get("location") ?? "") as MenuLocation;
  const scopePath = String(formData.get("scopePath") ?? "").trim();

  const result = await createMenu({
    key: String(formData.get("key") ?? ""),
    name: String(formData.get("name") ?? ""),
    location,
    scopePath: location === "contextual" ? scopePath : undefined,
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms/menus");
  return { error: null };
}

export async function deleteMenuAction(_prevState: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const result = await deleteMenu({ id: String(formData.get("menuId") ?? "") });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/admin/cms/menus");
  return { error: null };
}

export async function createMenuItemAction(_prevState: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const label = String(formData.get("label") ?? "");
  const parentId = String(formData.get("parentId") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim();
  const openInNewTab = formData.get("openInNewTab") === "true";
  const target = targetFromFormData(formData);

  if (!target) {
    return { error: "Selecione um destino válido para o item." };
  }

  const result = await createMenuItem({
    menuId,
    label,
    parentId: parentId || null,
    target,
    icon: icon || null,
    openInNewTab,
  });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath(`/admin/cms/menus/${menuId}`);
  return { error: null };
}

export async function updateMenuItemAction(_prevState: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const id = String(formData.get("menuItemId") ?? "");
  const label = String(formData.get("label") ?? "");
  const icon = String(formData.get("icon") ?? "").trim();
  const openInNewTab = formData.get("openInNewTab") === "true";
  const target = targetFromFormData(formData);

  if (!target) {
    return { error: "Selecione um destino válido para o item." };
  }

  const result = await updateMenuItem({ id, label, icon: icon || null, target, openInNewTab });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath(`/admin/cms/menus/${menuId}`);
  return { error: null };
}

export async function toggleMenuItemVisibilityAction(
  _prevState: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const result = await updateMenuItem({
    id: String(formData.get("menuItemId") ?? ""),
    isVisible: formData.get("isVisible") === "true",
  });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath(`/admin/cms/menus/${menuId}`);
  return { error: null };
}

export async function removeMenuItemAction(_prevState: MenuActionState, formData: FormData): Promise<MenuActionState> {
  const menuId = String(formData.get("menuId") ?? "");
  const result = await removeMenuItem({ id: String(formData.get("menuItemId") ?? "") });

  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath(`/admin/cms/menus/${menuId}`);
  return { error: null };
}

// Chamada direta (sem <form>) pelo drag-and-drop do construtor em árvore — não passa por
// useActionState porque não nasce de um submit.
export async function moveMenuItemAction(input: {
  id: string;
  parentId: string | null;
  order: number;
  menuId: string;
}): Promise<MenuActionState> {
  const result = await moveMenuItem({ id: input.id, parentId: input.parentId, order: input.order });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath(`/admin/cms/menus/${input.menuId}`);
  return { error: null };
}

export type ContentSearchResult = { id: string; title: string; slug: string; status: EntryStatus };

// Seletor de conteúdo por busca (nunca id/URL crus) — filtra no servidor pra não vazar entries
// além do que o admin de CMS já pode ver.
export async function searchContentAction(query: string): Promise<ContentSearchResult[]> {
  const result = await listEntriesForAdmin({});
  if (!result.success) return [];

  const needle = query.trim().toLowerCase();

  return result.data
    .filter((entry) => needle.length === 0 || entry.title.toLowerCase().includes(needle))
    .slice(0, 30)
    .map((entry) => ({ id: entry.id, title: entry.title, slug: entry.slug, status: entry.status }));
}
