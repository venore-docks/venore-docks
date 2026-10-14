import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { beginOperation, endOperation } from "@/observability";
import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
import { findMenuById, findMenuByScopePath, updateMenuFields } from "./store";
import type { UpdateMenuCommand, UpdateMenuResult } from "./types";

export async function updateMenu(command: UpdateMenuCommand): Promise<UpdateMenuResult> {
  const handle = beginOperation({
    useCase: "cms.update-menu",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existing = await findMenuById(command.id);
  if (!existing) {
    const error = { code: "cms.menus.not_found", message: `Menu "${command.id}" não encontrado.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  // B2: mesma forma canônica da criação e da leitura (normalizePathPrefix).
  let scopePath: string | undefined;
  if (command.scopePath !== undefined) {
    if (existing.location !== "contextual") {
      const error = {
        code: "cms.menus.scope_path_not_allowed",
        message: "scopePath só pode ser alterado em menus contextuais.",
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }

    const trimmed = command.scopePath.trim();
    if (!trimmed) {
      const error = { code: "cms.menus.scope_path_required", message: "scopePath não pode ser vazio." };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }

    scopePath = normalizePathPrefix(trimmed);
    const existingScope = existing.scopePath === null ? null : normalizePathPrefix(existing.scopePath);
    if (scopePath !== existingScope) {
      const conflict = await findMenuByScopePath(scopePath);
      if (conflict) {
        const error = {
          code: "cms.menus.scope_path_taken",
          message: `Já existe um menu contextual com o escopo "${scopePath}".`,
        };
        endOperation(handle, { success: false, error });
        return { success: false, error };
      }
    }
  }

  const menu = await updateMenuFields(command.id, {
    name: command.name,
    scopePath,
  });

  invalidateCacheByPrefix("cms:navigation");

  endOperation(handle, { success: true });
  return { success: true, data: menu };
}
