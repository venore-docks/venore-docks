import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { beginOperation, endOperation } from "@/observability";
import { findEntryExists, findMenuItemById, updateMenuItemFields } from "./store";
import type { UpdateMenuItemCommand, UpdateMenuItemResult } from "./types";

export async function updateMenuItem(command: UpdateMenuItemCommand): Promise<UpdateMenuItemResult> {
  const handle = beginOperation({
    useCase: "cms.update-menu-item",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findMenuItemById(command.id);
  if (!existing) {
    const error = { code: "cms.menus.item_not_found", message: `Item de menu "${command.id}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  if (command.target?.targetType === "content") {
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

  const item = await updateMenuItemFields(command.id, {
    label: command.label,
    isVisible: command.isVisible,
    icon: command.icon,
    // Troca de alvo sempre reescreve as 4 colunas — evita sobrar contentId/routePath de um
    // targetType anterior (o check constraint do schema já barraria isso, mas erra tarde).
    ...(command.target
      ? {
          targetType: command.target.targetType,
          contentId: command.target.targetType === "content" ? command.target.contentId : null,
          anchor: command.target.targetType === "content" ? command.target.anchor : null,
          routePath: command.target.targetType === "route" ? command.target.routePath : null,
          requiredPermissionKey: command.target.targetType === "route" ? command.target.requiredPermissionKey : null,
          externalUrl: command.target.targetType === "external" ? command.target.externalUrl : null,
        }
      : {}),
  });

  invalidateCacheByPrefix("cms:navigation");

  endOperation(handle, { success: true });
  return { success: true, data: item };
}
