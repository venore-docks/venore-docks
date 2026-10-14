import { getCache, setCache } from "@/infrastructure/cache/memory-cache";
import { normalizePathPrefix } from "@/shared/normalize-path-prefix";
import { getActorPermissionKeys } from "../../../actor-permission-keys";
import { filterMenuTreeByPermission, resolvePublicMenuTree } from "../../../menu-resolution";
import type { PreResolvedMenuItem } from "../../../menu-resolution";
import type { MenuItemRecord } from "../../../contracts/types";
import { findContextualMenus, findEntryRouteInfoByIds, findMenuItemsByMenuId } from "./store";
import type { GetContextualMenuQuery, GetContextualMenuResult } from "./types";

const CONTEXTUAL_INDEX_CACHE_KEY = "cms:navigation:contextual-index";
const CONTEXTUAL_MENU_CACHE_TTL_SECONDS = 60;

function isContentItem(item: MenuItemRecord): item is MenuItemRecord & { targetType: "content"; contentId: string } {
  return item.targetType === "content";
}

function menuCacheKeyFor(menuId: string): string {
  return `cms:navigation:menu:${menuId}`;
}

// B2: compara caminho e escopo na mesma forma canônica (normalizePathPrefix) — "/rh/", "rh",
// "/RH" e "/not%C3%ADcias" vs "/notícias" casam. Menus gravados antes da normalização na escrita
// continuam funcionando porque o escopo também é normalizado aqui, na leitura.
function matchesScope(path: string, scopePath: string): boolean {
  const normalizedPath = normalizePathPrefix(path);
  const normalizedScope = normalizePathPrefix(scopePath);
  return (
    normalizedScope === "/" || normalizedPath === normalizedScope || normalizedPath.startsWith(`${normalizedScope}/`)
  );
}

// Decisão travada: correspondência mais longa entre os scopePath cujo prefixo bate com `path`.
// Sem correspondência devolve undefined — quem chama não cai pro main-nav como padrão.
export function findLongestScopeMatch(
  candidates: Array<{ id: string; scopePath: string }>,
  path: string,
): { id: string; scopePath: string } | undefined {
  return candidates
    .filter((candidate) => matchesScope(path, candidate.scopePath))
    .sort((left, right) => normalizePathPrefix(right.scopePath).length - normalizePathPrefix(left.scopePath).length)[0];
}

async function resolvePreFilteredTree(menuId: string): Promise<PreResolvedMenuItem[]> {
  const cacheKey = menuCacheKeyFor(menuId);
  const cached = getCache<PreResolvedMenuItem[]>(cacheKey);
  if (cached) return cached;

  const rawItems = await findMenuItemsByMenuId(menuId);
  const contentIds = rawItems.filter(isContentItem).map((item) => item.contentId);
  const entriesById = await findEntryRouteInfoByIds(contentIds);

  const resolved = resolvePublicMenuTree(rawItems, entriesById);
  setCache(cacheKey, resolved, CONTEXTUAL_MENU_CACHE_TTL_SECONDS);

  return resolved;
}

export async function getContextualMenu(query: GetContextualMenuQuery): Promise<GetContextualMenuResult> {
  let candidates = getCache<Array<{ id: string; scopePath: string }>>(CONTEXTUAL_INDEX_CACHE_KEY);
  if (!candidates) {
    candidates = await findContextualMenus();
    setCache(CONTEXTUAL_INDEX_CACHE_KEY, candidates, CONTEXTUAL_MENU_CACHE_TTL_SECONDS);
  }

  const match = findLongestScopeMatch(candidates, query.path);
  if (!match) {
    return { success: true, data: [] };
  }

  const [preResolved, actorPermissionKeys] = await Promise.all([
    resolvePreFilteredTree(match.id),
    getActorPermissionKeys(),
  ]);

  return { success: true, data: filterMenuTreeByPermission(preResolved, actorPermissionKeys) };
}
