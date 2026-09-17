import type { MenuItemRecord } from "./contracts/types";

// Pura de propósito (sem import de contexts/auth|rbac): resolveAdminMenuTree é usada por
// get-menu-tree, que não precisa da cadeia getCurrentUser/getUserContext (e nem do next-auth que
// ela arrasta) só pra montar a árvore no admin — puxar isso aqui quebraria testes unitários fora
// de vitest.integration.config.ts (AGENTS.md §5 — next-auth só é stubado lá).
export function actorHasPermission(actorPermissionKeys: ReadonlySet<string>, requiredPermissionKey: string): boolean {
  return actorPermissionKeys.has("*") || actorPermissionKeys.has(requiredPermissionKey);
}

// Dado mínimo de rota resolvida a partir do id da entry — quem monta isso (store.ts de cada
// read use case) já faz o join com categories pra ter o slug da categoria. Ausência de uma
// entry no mapa == "apagada" (ela nunca é hard-deletada hoje, mas o modelo não depende disso —
// ver comentário de menu_items.contentId no schema).
export type EntryRouteInfo = {
  id: string;
  title: string;
  slug: string;
  categorySlug: string | null;
  status: "draft" | "published";
};

// Intermediário cacheável: já filtrou conteúdo apagado/despublicado/oculto, mas ainda carrega
// requiredPermissionKey — a checagem de permission do ator NÃO entra na chave de cache (o mesmo
// menu resolvido serve pra qualquer ator), então fica pra um segundo passe puro e barato
// (filterMenuTreeByPermission), rodado a cada request depois do cache hit.
export type PreResolvedMenuItem = {
  id: string;
  label: string;
  href: string | null; // null só pro grouper "label" — nunca renderiza como link.
  isExternal: boolean;
  icon: string | null;
  requiredPermissionKey: string | null;
  children: PreResolvedMenuItem[];
};

export type ResolvedMenuItem = {
  id: string;
  label: string;
  href: string | null;
  isExternal: boolean;
  icon: string | null;
  children: ResolvedMenuItem[];
};

export type AdminMenuItemStatus = "active" | "hidden" | "inactive-unpublished" | "pending-deleted";

export type AdminResolvedMenuItem = MenuItemRecord & {
  resolvedHref: string | null;
  contentTitle: string | null;
  status: AdminMenuItemStatus;
  reason: string | null;
  children: AdminResolvedMenuItem[];
};

type TreeNode = { id: string; parentId: string | null; order: number };

function buildChildrenIndex<T extends TreeNode>(items: T[]): Map<string | null, T[]> {
  const byParent = new Map<string | null, T[]>();
  items.forEach((item) => {
    const list = byParent.get(item.parentId) ?? [];
    list.push(item);
    byParent.set(item.parentId, list);
  });
  byParent.forEach((list) => list.sort((left, right) => left.order - right.order));
  return byParent;
}

function contentHref(entry: EntryRouteInfo, anchor: string | null): string {
  const path = entry.categorySlug ? `/${entry.categorySlug}/${entry.slug}` : `/${entry.slug}`;
  return anchor ? `${path}#${anchor}` : path;
}

// Resolução PÚBLICA (fase 1, cacheável): item cujo conteúdo não existe (apagado) ou não está
// publicado NUNCA aparece — sem meio-termo, a existência pública é decidida por entries, não aqui
// (invariante de ownership). Item oculto manualmente (`isVisible=false`) também some. Subárvore
// inteira some junto com o pai excluído — item filho nunca "sobe" pra substituir um pai invisível.
// Permission de item "route" NÃO é filtrada aqui de propósito: essa checagem depende do ator, e
// esta função é o que fica em cache compartilhado entre atores — ver filterMenuTreeByPermission.
export function resolvePublicMenuTree(
  items: MenuItemRecord[],
  entriesById: Map<string, EntryRouteInfo>,
): PreResolvedMenuItem[] {
  const childrenByParent = buildChildrenIndex(items);

  function resolveNode(item: MenuItemRecord): PreResolvedMenuItem | null {
    if (!item.isVisible) return null;

    let href: string | null;
    let isExternal = false;

    if (item.targetType === "content") {
      const entry = entriesById.get(item.contentId);
      if (!entry || entry.status !== "published") return null;
      href = contentHref(entry, item.anchor);
    } else if (item.targetType === "route") {
      href = item.routePath;
    } else if (item.targetType === "external") {
      href = item.externalUrl;
      isExternal = true;
    } else {
      href = null;
    }

    const children = (childrenByParent.get(item.id) ?? [])
      .map(resolveNode)
      .filter((child): child is PreResolvedMenuItem => child !== null);

    return {
      id: item.id,
      label: item.label,
      href,
      isExternal,
      icon: item.icon,
      requiredPermissionKey: item.targetType === "route" ? item.requiredPermissionKey : null,
      children,
    };
  }

  return (childrenByParent.get(null) ?? [])
    .map(resolveNode)
    .filter((node): node is PreResolvedMenuItem => node !== null);
}

// Resolução PÚBLICA (fase 2, por request): aplica a permission do ator sobre a árvore já
// resolvida (potencialmente vinda do cache) — item "route" com requiredPermissionKey exige a
// permission entre `actorPermissionKeys`; subárvore some junto com o item restrito.
export function filterMenuTreeByPermission(
  items: PreResolvedMenuItem[],
  actorPermissionKeys: ReadonlySet<string>,
): ResolvedMenuItem[] {
  function filterNode(item: PreResolvedMenuItem): ResolvedMenuItem | null {
    if (item.requiredPermissionKey && !actorHasPermission(actorPermissionKeys, item.requiredPermissionKey)) {
      return null;
    }

    const children = item.children.map(filterNode).filter((child): child is ResolvedMenuItem => child !== null);

    return { id: item.id, label: item.label, href: item.href, isExternal: item.isExternal, icon: item.icon, children };
  }

  return items.map(filterNode).filter((node): node is ResolvedMenuItem => node !== null);
}

// Resolução ADMIN: nunca remove item da árvore — anota status e motivo, pra montar sempre mesmo
// sem conteúdo publicado ainda, e pra deixar visível a razão de um item não aparecer no público.
export function resolveAdminMenuTree(
  items: MenuItemRecord[],
  entriesById: Map<string, EntryRouteInfo>,
): AdminResolvedMenuItem[] {
  const childrenByParent = buildChildrenIndex(items);

  function resolveNode(item: MenuItemRecord): AdminResolvedMenuItem {
    let resolvedHref: string | null = null;
    let contentTitle: string | null = null;
    let status: AdminMenuItemStatus = "active";
    let reason: string | null = null;

    if (item.targetType === "content") {
      const entry = entriesById.get(item.contentId);
      if (!entry) {
        status = "pending-deleted";
        reason = "O conteúdo apontado por este item não existe mais.";
      } else {
        contentTitle = entry.title;
        if (entry.status !== "published") {
          status = "inactive-unpublished";
          reason = "O conteúdo apontado por este item ainda não foi publicado.";
        } else {
          resolvedHref = contentHref(entry, item.anchor);
        }
      }
    } else if (item.targetType === "route") {
      resolvedHref = item.routePath;
    } else if (item.targetType === "external") {
      resolvedHref = item.externalUrl;
    }

    if (!item.isVisible) {
      status = "hidden";
      reason = "Item oculto manualmente — não aparece na navegação pública.";
    }

    const children = (childrenByParent.get(item.id) ?? []).map(resolveNode);

    return { ...item, resolvedHref, contentTitle, status, reason, children };
  }

  return (childrenByParent.get(null) ?? []).map(resolveNode);
}
