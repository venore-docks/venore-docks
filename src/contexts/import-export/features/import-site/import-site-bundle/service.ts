import {
  archiveEntry,
  createCategory as createCmsCategory,
  createContentType,
  createEntry,
  createMenu,
  createMenuItem,
  listCategories as listCmsCategories,
  listContentTypes,
  listEntriesForAdmin,
  listMenus,
  publishEntry,
  scheduleEntry,
  updateEntry,
  updateMenuItem,
  extractEntryComposition,
  type MenuItemTarget,
} from "@/contexts/cms";
import {
  createCategory as createMediaCategory,
  listCategories as listMediaCategories,
  listMediaAssets,
  uploadMediaAsset,
} from "@/contexts/media";
import { listUsers } from "@/contexts/auth";
import { beginOperation, endOperation } from "@/observability";
import { remapCompositionMediaIds } from "../../../composition-media-refs";
import { entryRef } from "../../../ref-format";
import type { ExportedMenuItem, ImportReport, ImportReportLine, ImportReportLineKind, ImportReportOutcome } from "../../../contracts/types";
import { exportManifestSchema, type ImportSiteBundleCommand, type ImportSiteBundleResult } from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildReport(lines: ImportReportLine[]): ImportReport {
  return {
    lines,
    createdCount: lines.filter((line) => line.outcome === "created").length,
    reusedCount: lines.filter((line) => line.outcome === "reused").length,
    skippedCount: lines.filter((line) => line.outcome === "skipped").length,
    failedCount: lines.filter((line) => line.outcome === "failed").length,
  };
}

function resolveMenuItemTarget(item: ExportedMenuItem, entryIdByRef: Map<string, string>): MenuItemTarget | null {
  switch (item.targetType) {
    case "content": {
      const contentId = item.contentRef ? entryIdByRef.get(item.contentRef) : undefined;
      return contentId ? { targetType: "content", contentId, anchor: item.anchor } : null;
    }
    case "route":
      return item.routePath ? { targetType: "route", routePath: item.routePath, requiredPermissionKey: item.requiredPermissionKey } : null;
    case "external":
      return item.externalUrl ? { targetType: "external", externalUrl: item.externalUrl } : null;
    case "label":
      return { targetType: "label" };
  }
}

// Único ponto que sabe gravar o pacote inteiro (mídia + CMS) no destino — orquestra os barrels
// públicos de cms/media/auth (AGENTS.md §1: service pode chamar service público de outro context
// via barrel), na ordem que respeita dependência entre entidades (mídia antes de entry, tag e
// categoria antes de entry, entry antes de menu). Nunca aborta o pacote inteiro por causa de uma
// linha ruim — cada entidade é best-effort e reportada (docs desta sessão: "pular e reportar").
export async function importSiteBundle(command: ImportSiteBundleCommand): Promise<ImportSiteBundleResult> {
  const parsed = exportManifestSchema.safeParse(command.manifest);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "import-export.invalid_manifest",
        message: "O manifest.json do pacote não tem o formato esperado (ou é de uma versão incompatível).",
      },
    };
  }
  const manifest = parsed.data;

  const handle = beginOperation({
    useCase: "import-export.import-site-bundle",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const [existingMediaCategories, existingMediaAssets, existingContentTypes, existingCmsCategories, existingEntries, existingMenus, existingUsers] =
    await Promise.all([
      listMediaCategories(),
      listMediaAssets({}),
      listContentTypes(),
      listCmsCategories(),
      listEntriesForAdmin(),
      listMenus(),
      listUsers(),
    ]);

  if (!existingMediaCategories.success) {
    endOperation(handle, existingMediaCategories);
    return existingMediaCategories;
  }
  if (!existingMediaAssets.success) {
    endOperation(handle, existingMediaAssets);
    return existingMediaAssets;
  }
  if (!existingContentTypes.success) {
    endOperation(handle, existingContentTypes);
    return existingContentTypes;
  }
  if (!existingCmsCategories.success) {
    endOperation(handle, existingCmsCategories);
    return existingCmsCategories;
  }
  if (!existingEntries.success) {
    endOperation(handle, existingEntries);
    return existingEntries;
  }
  if (!existingMenus.success) {
    endOperation(handle, existingMenus);
    return existingMenus;
  }
  if (!existingUsers.success) {
    endOperation(handle, existingUsers);
    return existingUsers;
  }

  const mediaCategoryIdByName = new Map(existingMediaCategories.data.map((category) => [category.name, category.id]));
  const mediaAssetIdByChecksum = new Map(existingMediaAssets.data.map((asset) => [asset.checksum, asset.id]));
  const contentTypeIdByKey = new Map(existingContentTypes.data.map((contentType) => [contentType.key, contentType.id]));
  const categoryIdByKey = new Map(existingCmsCategories.data.map((category) => [category.key, category.id]));
  const categoryKeyById = new Map(existingCmsCategories.data.map((category) => [category.id, category.key]));
  const menuIdByKey = new Map(existingMenus.data.map((menu) => [menu.key, menu.id]));
  const userIdByEmail = new Map(existingUsers.data.map((user) => [user.email, user.id]));

  const entryIdByRef = new Map<string, string>(
    existingEntries.data.map((entry) => [entryRef(entry.categoryId ? (categoryKeyById.get(entry.categoryId) ?? null) : null, entry.slug), entry.id]),
  );

  const lines: ImportReportLine[] = [];
  function record(kind: ImportReportLineKind, ref: string, outcome: ImportReportOutcome, message?: string): void {
    lines.push({ kind, ref, outcome, message });
  }

  // ---- 1. Categorias de mídia --------------------------------------------------------------
  for (const category of manifest.mediaCategories) {
    if (mediaCategoryIdByName.has(category.name)) {
      record("media-category", category.name, "skipped", "Já existe uma categoria de mídia com este nome no destino.");
      continue;
    }
    try {
      const created = await createMediaCategory({ name: category.name });
      if (!created.success) {
        record("media-category", category.name, "failed", created.error.message);
        continue;
      }
      mediaCategoryIdByName.set(category.name, created.data.id);
      record("media-category", category.name, "created");
    } catch (error) {
      record("media-category", category.name, "failed", errorMessage(error));
    }
  }

  // ---- 2. Assets de mídia (dedupe por checksum) --------------------------------------------
  for (const asset of manifest.mediaAssets) {
    if (mediaAssetIdByChecksum.has(asset.checksum)) {
      record("media-asset", asset.ref, "reused", "Já existe um arquivo idêntico (mesmo checksum) no destino — reaproveitado.");
      continue;
    }

    const bytes = command.files.get(asset.file);
    if (!bytes) {
      record("media-asset", asset.ref, "failed", `Arquivo "${asset.file}" não encontrado dentro do pacote.`);
      continue;
    }

    try {
      const categoryId = asset.categoryName ? mediaCategoryIdByName.get(asset.categoryName) : undefined;
      const uploaded = await uploadMediaAsset({
        filename: asset.filename,
        contentType: asset.contentType,
        size: bytes.byteLength,
        data: bytes,
        visibility: asset.visibility,
        categoryId: categoryId ?? undefined,
      });
      if (!uploaded.success) {
        record("media-asset", asset.ref, "failed", uploaded.error.message);
        continue;
      }
      mediaAssetIdByChecksum.set(asset.checksum, uploaded.data.id);
      record("media-asset", asset.ref, "created");
    } catch (error) {
      record("media-asset", asset.ref, "failed", errorMessage(error));
    }
  }

  // ---- 3. Tags (content types) --------------------------------------------------------------
  for (const contentType of manifest.contentTypes) {
    if (contentTypeIdByKey.has(contentType.key)) {
      record("content-type", contentType.key, "skipped", "Já existe uma tag com esta key no destino.");
      continue;
    }
    try {
      const created = await createContentType({ key: contentType.key, name: contentType.name, description: contentType.description ?? undefined });
      if (!created.success) {
        record("content-type", contentType.key, "failed", created.error.message);
        continue;
      }
      contentTypeIdByKey.set(contentType.key, created.data.id);
      record("content-type", contentType.key, "created");
    } catch (error) {
      record("content-type", contentType.key, "failed", errorMessage(error));
    }
  }

  // ---- 4. Categorias de CMS -------------------------------------------------------------------
  for (const category of manifest.categories) {
    if (categoryIdByKey.has(category.key)) {
      record("category", category.key, "skipped", "Já existe uma categoria com esta key no destino.");
      continue;
    }
    try {
      const created = await createCmsCategory({
        key: category.key,
        slug: category.slug,
        name: category.name,
        description: category.description ?? undefined,
      });
      if (!created.success) {
        record("category", category.key, "failed", created.error.message);
        continue;
      }
      categoryIdByKey.set(category.key, created.data.id);
      categoryKeyById.set(created.data.id, category.key);
      record("category", category.key, "created");
    } catch (error) {
      record("category", category.key, "failed", errorMessage(error));
    }
  }

  // ---- 5. Entries -------------------------------------------------------------------------------
  for (const entry of manifest.entries) {
    if (entryIdByRef.has(entry.ref)) {
      record("entry", entry.ref, "skipped", "Já existe uma entry com este slug/categoria no destino.");
      continue;
    }

    const categoryId = entry.categoryKey ? categoryIdByKey.get(entry.categoryKey) : undefined;
    if (entry.categoryKey && !categoryId) {
      record("entry", entry.ref, "failed", `Categoria "${entry.categoryKey}" não foi importada — entry pulada.`);
      continue;
    }

    const contentTypeIds = entry.tagKeys.map((key) => contentTypeIdByKey.get(key)).filter((id): id is string => Boolean(id));

    const composition = extractEntryComposition(entry.data);
    const rawData = entry.data && typeof entry.data === "object" ? (entry.data as Record<string, unknown>) : {};
    const data = composition
      ? { ...rawData, blocks: remapCompositionMediaIds(composition, (ref) => mediaAssetIdByChecksum.get(ref) ?? null) }
      : rawData;

    const authorId = entry.authorEmail ? userIdByEmail.get(entry.authorEmail) : undefined;
    const authorNote =
      entry.authorEmail && !authorId
        ? ` Autor original ("${entry.authorEmail}") não existe no destino — atribuída a quem importou.`
        : entry.authorEmail && authorId !== command.actorId
          ? ` Atribuída a quem importou — não existe API para preservar a autoria original ("${entry.authorEmail}") na importação.`
          : "";

    try {
      const created = await createEntry({
        contentTypeIds,
        categoryId,
        title: entry.title,
        slug: entry.slug,
        visibility: entry.visibility,
        data,
        mediaId: entry.mediaRef ? mediaAssetIdByChecksum.get(entry.mediaRef) : undefined,
      });

      if (!created.success) {
        record("entry", entry.ref, "failed", created.error.message);
        continue;
      }

      entryIdByRef.set(entry.ref, created.data.id);

      let transitionNote = "";
      if (entry.status === "published") {
        const published = await publishEntry({ id: created.data.id, resolveDefinition: command.resolveDefinition });
        if (!published.success) {
          transitionNote = ` Criada como rascunho — falha ao publicar: ${published.error.message}`;
        } else if (entry.scheduledArchiveAt) {
          const updated = await updateEntry({ id: created.data.id, scheduledArchiveAt: new Date(entry.scheduledArchiveAt) });
          if (!updated.success) {
            transitionNote = ` Publicada, mas falha ao agendar arquivamento: ${updated.error.message}`;
          }
        }
      } else if (entry.status === "scheduled" && entry.scheduledPublishAt) {
        const publishAt = new Date(entry.scheduledPublishAt);
        if (Number.isFinite(publishAt.getTime()) && publishAt.getTime() > Date.now()) {
          const scheduled = await scheduleEntry({
            id: created.data.id,
            scheduledPublishAt: publishAt,
            scheduledArchiveAt: entry.scheduledArchiveAt ? new Date(entry.scheduledArchiveAt) : null,
          });
          if (!scheduled.success) {
            transitionNote = ` Criada como rascunho — falha ao agendar: ${scheduled.error.message}`;
          }
        } else {
          transitionNote = " Criada como rascunho — a data de publicação agendada original já passou.";
        }
      } else if (entry.status === "archived") {
        const archived = await archiveEntry({ id: created.data.id });
        if (!archived.success) {
          transitionNote = ` Criada como rascunho — falha ao arquivar: ${archived.error.message}`;
        }
      }

      record("entry", entry.ref, "created", (transitionNote + authorNote).trim() || undefined);
    } catch (error) {
      record("entry", entry.ref, "failed", errorMessage(error));
    }
  }

  // ---- 6. Menus + itens ---------------------------------------------------------------------
  for (const menu of manifest.menus) {
    if (menuIdByKey.has(menu.key)) {
      record("menu", menu.key, "skipped", `Já existe um menu com esta key no destino — ${menu.items.length} item(ns) do pacote não foram tocados.`);
      continue;
    }

    let createdMenuId: string;
    try {
      const created = await createMenu({ key: menu.key, name: menu.name, location: menu.location, scopePath: menu.scopePath });
      if (!created.success) {
        record("menu", menu.key, "failed", created.error.message);
        continue;
      }
      createdMenuId = created.data.id;
      menuIdByKey.set(menu.key, createdMenuId);
      record("menu", menu.key, "created");
    } catch (error) {
      record("menu", menu.key, "failed", errorMessage(error));
      continue;
    }

    const itemsByParent = new Map<string | null, ExportedMenuItem[]>();
    for (const item of menu.items) {
      const list = itemsByParent.get(item.parentExportId) ?? [];
      list.push(item);
      itemsByParent.set(item.parentExportId, list);
    }

    async function createLevel(parentExportId: string | null, parentRealId: string | null): Promise<void> {
      const level = (itemsByParent.get(parentExportId) ?? []).sort((left, right) => left.order - right.order);
      for (const item of level) {
        const itemRef = `${menu.key}:${item.label}`;
        const target = resolveMenuItemTarget(item, entryIdByRef);
        if (!target) {
          record("menu-item", itemRef, "failed", "O alvo deste item não pôde ser resolvido no destino (conteúdo/rota/link ausente).");
          continue;
        }

        try {
          const createdItem = await createMenuItem({
            menuId: createdMenuId,
            parentId: parentRealId,
            label: item.label,
            target,
            icon: item.icon,
            openInNewTab: item.openInNewTab,
          });
          if (!createdItem.success) {
            record("menu-item", itemRef, "failed", createdItem.error.message);
            continue;
          }

          // createMenuItem não aceita isVisible (nasce sempre true) — precisa de um segundo
          // passo pra reproduzir um item que já nascia oculto na origem.
          if (!item.isVisible) {
            const updated = await updateMenuItem({ id: createdItem.data.id, isVisible: false });
            if (!updated.success) {
              record("menu-item", itemRef, "created", `Criado, mas não foi possível ocultá-lo como na origem: ${updated.error.message}`);
              await createLevel(item.exportId, createdItem.data.id);
              continue;
            }
          }

          record("menu-item", itemRef, "created");
          await createLevel(item.exportId, createdItem.data.id);
        } catch (error) {
          record("menu-item", itemRef, "failed", errorMessage(error));
        }
      }
    }

    await createLevel(null, null);
  }

  const report = buildReport(lines);
  endOperation(handle, { success: true });
  return { success: true, data: report };
}
