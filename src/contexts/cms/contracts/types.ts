export type ContentTypeRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryRecord = {
  id: string;
  key: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EntryStatus = "draft" | "scheduled" | "published" | "archived";

// "public": qualquer visitante (logado ou não). "authenticated": só usuário logado. Ver
// enforcement em get-published-entry-by-slug (Fase 2/C7 — docs/implementation-roadmap.md).
export type EntryVisibility = "public" | "authenticated";

export type EntryRecord = {
  id: string;
  // Tag N:N (Fase 2/#2) — substitui o antigo contentTypeId singular (FK notNull, 1:1). O
  // mínimo de uma tag é regra de negócio (create-entry/update-entry), não constraint de banco —
  // a tabela de junção em si aceita zero linhas por entry.
  contentTypeIds: string[];
  categoryId: string | null;
  title: string;
  slug: string;
  status: EntryStatus;
  // scheduledPublishAt é obrigatório de fato (não só de tipo) quando status é "scheduled" —
  // validado em schedule-entry, não representado no tipo pra não duplicar a regra em dois
  // lugares. scheduledArchiveAt é independente: pode estar presente em "scheduled" ou
  // "published" ao mesmo tempo (agendar publicação e arquivamento não se excluem).
  scheduledPublishAt: Date | null;
  scheduledArchiveAt: Date | null;
  visibility: EntryVisibility;
  // Fase 3/C9 — incrementado em lote por cms/view-tracking.ts, nunca por escrita síncrona.
  viewCount: number;
  data: unknown;
  mediaId: string | null;
  // Não-null == entry gerenciada por outro context/plugin (ex: "academy") e escondida de
  // /admin/cms/entries — ver comentário no schema (database/schema/index.ts).
  internalOwner: string | null;
  authorId: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// "main" | "header" | "sitemap": no máximo um menu por location (unique index parcial no schema).
// "contextual": vários menus, cada um com scopePath (prefixo de rota) — ver menu-resolution.ts.
export type MenuLocation = "main" | "header" | "contextual" | "sitemap";

export type MenuRecord = {
  id: string;
  key: string;
  name: string;
  location: MenuLocation;
  scopePath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// União discriminada, não um contentId anulável — só o campo do targetType escolhido é
// preenchido. "content" guarda o id da entry (não a URL): href é resolvido em tempo de leitura a
// partir da rota atual daquela entry, mesmo princípio de mediaId (ver comentário em EntryRecord
// acima e no schema). "label" é rótulo sem link — agrupador, usado em sitemap/submenu.
export type MenuItemTarget =
  // anchor: id de âncora opcional (Block.htmlId) dentro da página apontada — vira /slug#anchor em
  // tempo de leitura (contentHref em menu-resolution.ts). "route" já resolve isso com o próprio
  // texto livre de routePath (ex: "/pagina#id"); "content" precisava de um campo dedicado porque
  // seu href é derivado da entry, não digitado.
  | { targetType: "content"; contentId: string; anchor: string | null }
  | { targetType: "route"; routePath: string; requiredPermissionKey: string | null }
  | { targetType: "external"; externalUrl: string }
  | { targetType: "label" };

export type MenuItemRecord = {
  id: string;
  menuId: string;
  parentId: string | null;
  // Rótulo próprio do item — independente do título do conteúdo apontado (quando for "content").
  label: string;
  order: number;
  isVisible: boolean;
  // Chave lógica de ícone (contexts/themes/contracts/types.ts — NavItem/MainNavItem.icon), nunca
  // o componente — escolhida por quem monta o menu (editor admin), resolvida pro lucide-react
  // real só dentro do tema (platform/nav-icons/registry.ts). Opcional em qualquer targetType.
  icon: string | null;
  // Só relevante pra "content"/"route" — o editor escolhe abrir o link interno em nova aba.
  // "external" ignora este campo e abre em nova aba sempre (regra fixa, ver menu-resolution.ts).
  openInNewTab: boolean;
  createdAt: Date;
  updatedAt: Date;
} & MenuItemTarget;
