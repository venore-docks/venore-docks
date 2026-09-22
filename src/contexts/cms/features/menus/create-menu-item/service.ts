import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { beginOperation, endOperation } from "@/observability";
import { MAX_MENU_ITEM_DEPTH, wouldExceedMaxDepth } from "../../../menu-tree";
import { findEntryExists, findMenuById, findMenuItemsByMenuId, insertMenuItem } from "./store";
import type { CreateMenuItemCommand, CreateMenuItemResult } from "./types";

// id sentinela: nunca colide com um uuid real, usado só pra calcular a profundidade de um item
// que ainda não foi inserido (ver menu-tree.ts — subtreeHeight de um id ausente é sempre 1).
const PENDING_ITEM_ID = "__pending-menu-item__";

export async function createMenuItem(command: CreateMenuItemCommand): Promise<CreateMenuItemResult> {
  const handle = beginOperation({
    useCase: "cms.create-menu-item",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const menu = await findMenuById(command.menuId);
  if (!menu) {
    const error = { code: "cms.menus.not_found", message: `Menu "${command.menuId}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  const siblings = await findMenuItemsByMenuId(command.menuId);
  const parentId = command.parentId ?? null;

  if (parentId) {
    const parent = siblings.find((item) => item.id === parentId);
    if (!parent) {
      const error = { code: "cms.menus.parent_not_found", message: `Item pai "${parentId}" não encontrado neste menu.` };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  }

  if (wouldExceedMaxDepth(siblings, PENDING_ITEM_ID, parentId)) {
    const error = {
      code: "cms.menus.max_depth_exceeded",
      message: `Item excederia a profundidade máxima permitida (${MAX_MENU_ITEM_DEPTH}).`,
    };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  if (command.target.targetType === "content") {
    const exists = await findEntryExists(command.target.contentId);
    if (!exists) {
      const error = {
        code: "cms.menus.content_not_found",
        message: `Nenhum conteúdo encontrado com id "${command.target.contentId}".`,
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  }

  const order =
    Math.max(-1, ...siblings.filter((item) => item.parentId === parentId).map((item) => item.order)) + 1;

  const item = await insertMenuItem({
    menuId: command.menuId,
    parentId,
    label: command.label,
    order,
    targetType: command.target.targetType,
    contentId: command.target.targetType === "content" ? command.target.contentId : null,
    anchor: command.target.targetType === "content" ? command.target.anchor : null,
    routePath: command.target.targetType === "route" ? command.target.routePath : null,
    requiredPermissionKey: command.target.targetType === "route" ? command.target.requiredPermissionKey : null,
    externalUrl: command.target.targetType === "external" ? command.target.externalUrl : null,
    icon: command.icon ?? null,
    openInNewTab: command.openInNewTab ?? false,
  });

  invalidateCacheByPrefix("cms:navigation");

  endOperation(handle, { success: true });
  return { success: true, data: item };
}
