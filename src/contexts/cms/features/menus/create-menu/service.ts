import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { beginOperation, endOperation } from "@/observability";
import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
import { findMenuByKey, findMenuByLocation, findMenuByScopePath, insertMenu } from "./store";
import type { CreateMenuCommand, CreateMenuResult } from "./types";

export async function createMenu(command: CreateMenuCommand): Promise<CreateMenuResult> {
  const handle = beginOperation({
    useCase: "cms.create-menu",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const existingKey = await findMenuByKey(command.key);
  if (existingKey) {
    const error = { code: "cms.menus.key_taken", message: `Já existe um menu com a chave "${command.key}".` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  let scopePath: string | null = null;

  if (command.location === "contextual") {
    // B2: grava sempre na forma canônica (decodificada, NFC, minúscula, "/" inicial, sem "/" final)
    // — "/RH/", "rh" e "/rh" viram o mesmo escopo, e a checagem de duplicidade enxerga isso.
    const raw = command.scopePath?.trim() || "";
    scopePath = raw ? normalizePathPrefix(raw) : "";
    if (!scopePath) {
      const error = {
        code: "cms.menus.scope_path_required",
        message: "Menu contextual exige um scopePath (prefixo de rota).",
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }

    const existingScope = await findMenuByScopePath(scopePath);
    if (existingScope) {
      const error = {
        code: "cms.menus.scope_path_taken",
        message: `Já existe um menu contextual com o escopo "${scopePath}".`,
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  } else {
    if (command.scopePath) {
      const error = {
        code: "cms.menus.scope_path_not_allowed",
        message: "scopePath só é permitido em menus contextuais.",
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }

    // Invariante de unicidade: main/header/sitemap têm no máximo um menu por location. O unique
    // index parcial no schema é a garantia de verdade sob concorrência — esta checagem só existe
    // pra devolver um erro de negócio legível em vez do usuário ver uma constraint do Postgres.
    const existingLocation = await findMenuByLocation(command.location);
    if (existingLocation) {
      const error = {
        code: "cms.menus.location_taken",
        message: `Já existe um menu na location "${command.location}". Remova-o antes de criar outro.`,
      };
      endOperation(handle, { success: false, error });
      return { success: false, error };
    }
  }

  const menu = await insertMenu({
    key: command.key,
    name: command.name,
    location: command.location,
    scopePath,
  });

  invalidateCacheByPrefix("cms:navigation");

  endOperation(handle, { success: true });
  return { success: true, data: menu };
}
