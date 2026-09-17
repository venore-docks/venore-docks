import {
  type AdminResolvedMenuItem,
  type EntryRecord,
  extractEntryComposition,
  getMenuTree,
  listCategories,
  listContentTypes,
  listEntriesForAdmin,
  listMenus,
} from "@/contexts/cms";
import { listMediaAssets, listCategories as listMediaCategories, type MediaAsset } from "@/contexts/media";
import { listUsers } from "@/contexts/auth";
import { remapCompositionMediaIds } from "../../../composition-media-refs";
import { entryRef } from "../../../ref-format";
import {
  IMPORT_EXPORT_FORMAT,
  IMPORT_EXPORT_FORMAT_VERSION,
  type ExportedCategory,
  type ExportedContentType,
  type ExportedEntry,
  type ExportedMenu,
  type ExportedMenuItem,
} from "../../../contracts/types";
import type { ExportSiteBundleAssetFile, ExportSiteBundleResult } from "./types";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function downloadAssetBytes(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar mídia de "${url}" (HTTP ${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Aplaina a árvore de AdminResolvedMenuItem (já vem aninhada em .children) pra uma lista com
// exportId/parentExportId sintéticos — mesmo formato de entrada que import-site-bundle espera pra
// recriar a árvore no destino, sem carregar nenhum id de banco de origem.
function flattenMenuItems(items: AdminResolvedMenuItem[], entryRefById: Map<string, string>, parentExportId: string | null, counter: { value: number }, out: ExportedMenuItem[]): void {
  for (const item of items) {
    const exportId = `mi_${counter.value++}`;

    const contentRef = item.targetType === "content" ? (entryRefById.get(item.contentId) ?? null) : null;

    out.push({
      exportId,
      parentExportId,
      label: item.label,
      order: item.order,
      isVisible: item.isVisible,
      icon: item.icon,
      targetType: item.targetType,
      contentRef,
      anchor: item.targetType === "content" ? item.anchor : null,
      routePath: item.targetType === "route" ? item.routePath : null,
      requiredPermissionKey: item.targetType === "route" ? item.requiredPermissionKey : null,
      externalUrl: item.targetType === "external" ? item.externalUrl : null,
    });

    flattenMenuItems(item.children, entryRefById, exportId, counter, out);
  }
}

// Único ponto que sabe montar o pacote inteiro (manifest + bytes de mídia) — orquestra os
// barrels públicos de cms/media/auth, nunca acessa store de nenhum dos três (regra de layering,
// AGENTS.md §1: service pode chamar service público de outro context via barrel).
export async function exportSiteBundle(): Promise<ExportSiteBundleResult> {
  const [contentTypesResult, categoriesResult, entriesResult, menusResult, mediaCategoriesResult, mediaAssetsResult, usersResult] =
    await Promise.all([
      listContentTypes(),
      listCategories(),
      listEntriesForAdmin(),
      listMenus(),
      listMediaCategories(),
      listMediaAssets({}),
      listUsers(),
    ]);

  if (!contentTypesResult.success) return contentTypesResult;
  if (!categoriesResult.success) return categoriesResult;
  if (!entriesResult.success) return entriesResult;
  if (!menusResult.success) return menusResult;
  if (!mediaCategoriesResult.success) return mediaCategoriesResult;
  if (!mediaAssetsResult.success) return mediaAssetsResult;
  if (!usersResult.success) return usersResult;

  const contentTypeKeyById = new Map(contentTypesResult.data.map((contentType) => [contentType.id, contentType.key]));
  const categoryKeyById = new Map(categoriesResult.data.map((category) => [category.id, category.key]));
  const mediaCategoryNameById = new Map(mediaCategoriesResult.data.map((category) => [category.id, category.name]));
  const emailByUserId = new Map(usersResult.data.map((user) => [user.id, user.email]));
  const checksumByMediaAssetId = new Map(mediaAssetsResult.data.map((asset) => [asset.id, asset.checksum]));

  const entryRefById = new Map<string, string>(
    entriesResult.data.map((entry: EntryRecord) => [
      entry.id,
      entryRef(entry.categoryId ? (categoryKeyById.get(entry.categoryId) ?? null) : null, entry.slug),
    ]),
  );

  const contentTypes: ExportedContentType[] = contentTypesResult.data.map((contentType) => ({
    key: contentType.key,
    name: contentType.name,
    description: contentType.description,
  }));

  const categories: ExportedCategory[] = categoriesResult.data.map((category) => ({
    key: category.key,
    slug: category.slug,
    name: category.name,
    description: category.description,
  }));

  const entries: ExportedEntry[] = entriesResult.data.map((entry) => {
    const categoryKey = entry.categoryId ? (categoryKeyById.get(entry.categoryId) ?? null) : null;
    const composition = extractEntryComposition(entry.data);
    const rawData = entry.data && typeof entry.data === "object" ? (entry.data as Record<string, unknown>) : {};

    const data = composition
      ? {
          ...rawData,
          blocks: remapCompositionMediaIds(composition, (mediaId) => checksumByMediaAssetId.get(mediaId) ?? null),
        }
      : rawData;

    return {
      ref: entryRef(categoryKey, entry.slug),
      categoryKey,
      tagKeys: entry.contentTypeIds.map((id) => contentTypeKeyById.get(id)).filter((key): key is string => Boolean(key)),
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      scheduledPublishAt: toIso(entry.scheduledPublishAt),
      scheduledArchiveAt: toIso(entry.scheduledArchiveAt),
      visibility: entry.visibility,
      data,
      mediaRef: entry.mediaId ? (checksumByMediaAssetId.get(entry.mediaId) ?? null) : null,
      authorEmail: emailByUserId.get(entry.authorId) ?? null,
      publishedAt: toIso(entry.publishedAt),
    };
  });

  const menuTreesResult = await Promise.all(menusResult.data.map((menu) => getMenuTree({ menuId: menu.id })));
  const failedMenuTree = menuTreesResult.find((result) => !result.success);
  if (failedMenuTree && !failedMenuTree.success) return failedMenuTree;

  const menus: ExportedMenu[] = menusResult.data.map((menu, index) => {
    const treeResult = menuTreesResult[index];
    const items: ExportedMenuItem[] = [];
    if (treeResult.success) {
      flattenMenuItems(treeResult.data.items, entryRefById, null, { value: 1 }, items);
    }

    return { key: menu.key, name: menu.name, location: menu.location, scopePath: menu.scopePath, items };
  });

  const files: ExportSiteBundleAssetFile[] = [];
  const mediaAssets = await Promise.all(
    mediaAssetsResult.data.map(async (asset: MediaAsset) => {
      const filePath = `assets/${asset.checksum}-${sanitizeFilename(asset.filename)}`;
      const data = await downloadAssetBytes(asset.url);
      files.push({ path: filePath, data });

      return {
        ref: asset.checksum,
        filename: asset.filename,
        contentType: asset.contentType,
        size: asset.size,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        checksum: asset.checksum,
        visibility: asset.visibility,
        categoryName: asset.categoryId ? (mediaCategoryNameById.get(asset.categoryId) ?? null) : null,
        file: filePath,
      };
    }),
  );

  return {
    success: true,
    data: {
      manifest: {
        format: IMPORT_EXPORT_FORMAT,
        formatVersion: IMPORT_EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        mediaCategories: mediaCategoriesResult.data.map((category) => ({ name: category.name })),
        mediaAssets,
        contentTypes,
        categories,
        entries,
        menus,
      },
      files,
    },
  };
}
