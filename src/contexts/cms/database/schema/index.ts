import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, check, integer, jsonb, pgSchema, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/contexts/auth/database/schema";

export const cmsSchema = pgSchema("cms");

export const contentTypes = cmsSchema.table("content_types", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = cmsSchema.table("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  // URL pública da categoria: /<slug>/<entry-slug> (docs/venore-docks.md — decisão de rota pública).
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entries = cmsSchema.table(
  "entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    // "draft" | "scheduled" | "published" | "archived" — ver contracts/types.ts (EntryStatus).
    // "scheduled" espera scheduledPublishAt; scheduledArchiveAt pode estar presente em
    // "scheduled" ou "published" (agendamento de publicação e de arquivamento são independentes
    // um do outro — docs/implementation-roadmap.md, Fase 2/C5). Varredura que faz a transição
    // automática mora em cms/scheduling.ts, não aqui.
    status: text("status").notNull().default("draft"),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
    scheduledArchiveAt: timestamp("scheduled_archive_at", { withTimezone: true }),
    // "public" (qualquer visitante) | "authenticated" (só logado) — ver contracts/types.ts
    // (EntryVisibility). Enforced na leitura pública (get-published-entry-by-slug e a rota que a
    // consome), nunca em list-entries-for-admin (tela de admin já é gated por permission).
    visibility: text("visibility").notNull().default("public"),
    // Contador de acesso (Fase 3/C9 — docs/implementation-roadmap.md): incrementado em lote pela
    // varredura de cms/view-tracking.ts, nunca por UPDATE síncrono por request (mesmo motivo do
    // buffer de log em observability — AGENTS.md §2, "log síncrono por chamada").
    viewCount: integer("view_count").notNull().default(0),
    // Conteúdo livre por content type — sem fieldsSchema nesta v1 (docs/venore-docks.md — CMS ainda não cobre page-builder).
    data: jsonb("data").notNull().default({}),
    // Sem FK: cross-schema FK entre contexts violaria o isolamento de schema por domínio
    // (docs/venore-docks.md — Schema do Postgres por domínio). Validado na aplicação via
    // contexts/media (regra 10 de composição), não no banco.
    mediaId: text("media_id"),
    // Marca uma entry criada por outro context/plugin como implementação (ex: "academy", pra
    // seção de texto de aula via page builder — pedido desta sessão) — nunca aparece em
    // /admin/cms/entries (list-entries-for-admin filtra internalOwner IS NULL incondicionalmente,
    // docs/venore-docks.md), mas continua uma entry de verdade: página/composição/builder
    // funcionam normalmente, só some da listagem editorial. null == entry autoral comum do CMS.
    internalOwner: text("internal_owner"),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (entry) => [
    // URL pública: /<slug> quando categoryId é null, /<categoria-slug>/<slug> quando não é —
    // content type nunca aparece na URL, então a unicidade migra de (contentTypeId, slug) pra
    // (categoryId, slug). NULL != NULL num índice único do Postgres, então este índice sozinho já
    // não colide entre entries sem categoria; o segundo cobre a unicidade isolada desse caso.
    uniqueIndex("entries_category_slug_idx").on(entry.categoryId, entry.slug),
    check("entries_status_valid", sql`${entry.status} IN ('draft', 'scheduled', 'published', 'archived')`),
    check("entries_visibility_valid", sql`${entry.visibility} IN ('public', 'authenticated')`),
    uniqueIndex("entries_null_category_slug_idx")
      .on(entry.slug)
      .where(sql`${entry.categoryId} is null`),
  ],
);

// Tag (N:N — decisão registrada em docs/implementation-roadmap.md, Fase 2/#2): um conteúdo pode
// ter mais de uma tag, então a associação migrou de entries.content_type_id (FK notNull, 1:1)
// pra esta tabela de junção. O nome da tabela `content_types` (e da própria variável acima)
// ainda é o nome físico antigo — o rename de vocabulário pra "tag" na tela/rota/permission fica
// pra Fase 3 (junto do rename CMS → "Editorial"), pra não duplicar o mesmo trabalho de relabeling
// em duas sessões; aqui só a relação de cardinalidade mudou.
export const entryContentTypes = cmsSchema.table(
  "entry_content_types",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    contentTypeId: text("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.entryId, table.contentTypeId] })],
);

// Menu define O QUE APARECE na navegação — nunca é derivado de "todo conteúdo publicado"
// (docs/venore-docks.md — invariante de ownership da navegação: entries definem o que existe,
// menus definem o que aparece). "main" | "header" | "sitemap" têm no máximo um menu ativo por
// localização (unique index parcial abaixo); "contextual" permite vários, cada um com scopePath
// próprio. Não existe campo de estado ativo/inativo no menu em si — a unicidade da linha já é
// o invariante ("ativo" na regra de negócio == "existe uma linha pra essa location").
export const menus = cmsSchema.table(
  "menus",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    // "main" | "header" | "contextual" | "sitemap".
    location: text("location").notNull(),
    // Prefixo de rota — obrigatório só quando location = "contextual" (check abaixo). Resolução
    // contextual escolhe o menu cujo scopePath é a correspondência mais longa com a rota atual;
    // sem correspondência não há navegação contextual (não cai pro main).
    scopePath: text("scope_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (menu) => [
    uniqueIndex("menus_singleton_location_idx").on(menu.location).where(sql`${menu.location} <> 'contextual'`),
    uniqueIndex("menus_contextual_scope_idx").on(menu.scopePath).where(sql`${menu.location} = 'contextual'`),
    check(
      "menus_scope_path_matches_location",
      sql`(${menu.location} = 'contextual' AND ${menu.scopePath} IS NOT NULL AND length(trim(${menu.scopePath})) > 0)
        OR (${menu.location} <> 'contextual' AND ${menu.scopePath} IS NULL)`,
    ),
    check("menus_location_valid", sql`${menu.location} IN ('main', 'header', 'contextual', 'sitemap')`),
  ],
);

// Item de menu: alvo é união discriminada por targetType, não um contentId anulável solto — só
// a coluna correspondente ao targetType é preenchida (check abaixo). "content" guarda o id da
// entry, nunca a URL: renomear/mover a rota de uma entry não quebra o menu, o href é resolvido em
// tempo de leitura (mesmo princípio de mediaId em contracts/types.ts — resolvido por id, sem FK
// cross-schema). "label" não guarda alvo nenhum — grupo/rótulo sem link, usado em sitemap/submenu.
export const menuItems = cmsSchema.table(
  "menu_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    menuId: text("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnyPgColumn => menuItems.id, { onDelete: "cascade" }),
    // Rótulo do item é independente do título do conteúdo — editor decide o texto exibido no
    // menu, entry mantém o título dela.
    label: text("label").notNull(),
    order: integer("order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    // "content" | "route" | "external" | "label".
    targetType: text("target_type").notNull(),
    // Chave lógica de ícone (contexts/themes/contracts/types.ts — NavItem/MainNavItem.icon),
    // nunca o componente: quem monta o menu escolhe no editor (create-menu-item), resolvido pro
    // lucide-react real só dentro do tema (platform/nav-icons/registry.ts). Opcional — sem ícone,
    // o tema cai no fallback genérico.
    icon: text("icon"),
    // Sem FK: cross-schema/cross-agregado FK pra entries quebraria "conteúdo apagado não derruba
    // a montagem do menu" — mesma decisão de entries.mediaId acima. Resolvido por id em tempo de
    // leitura; ausência vira pendência no admin, item some do público.
    contentId: text("content_id"),
    // Só usado com targetType "content" — id de âncora (Block.htmlId) dentro da página apontada.
    // Fora do check constraint abaixo de propósito: opcional em qualquer targetType, mesmo
    // tratamento de `icon`, não um par obrigatório de contentId.
    anchor: text("anchor"),
    routePath: text("route_path"),
    // Só tem efeito em "content"/"route" — link interno abre em nova aba só quando o editor marcar
    // (menu-resolution.ts calcula opensInNewTab = isExternal || openInNewTab). "external" já abre
    // em nova aba sempre, independente deste campo (regra de negócio, não constraint de banco).
    openInNewTab: boolean("open_in_new_tab").notNull().default(false),
    // Só item "route" pode exigir permission — filtrada pela permission do ator no servidor.
    requiredPermissionKey: text("required_permission_key"),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (item) => [
    check(
      "menu_items_target_matches_type",
      sql`(${item.targetType} = 'content' AND ${item.contentId} IS NOT NULL AND ${item.routePath} IS NULL AND ${item.externalUrl} IS NULL)
        OR (${item.targetType} = 'route' AND ${item.routePath} IS NOT NULL AND ${item.contentId} IS NULL AND ${item.externalUrl} IS NULL)
        OR (${item.targetType} = 'external' AND ${item.externalUrl} IS NOT NULL AND ${item.contentId} IS NULL AND ${item.routePath} IS NULL)
        OR (${item.targetType} = 'label' AND ${item.contentId} IS NULL AND ${item.routePath} IS NULL AND ${item.externalUrl} IS NULL)`,
    ),
    check(
      "menu_items_required_permission_only_on_route",
      sql`${item.requiredPermissionKey} IS NULL OR ${item.targetType} = 'route'`,
    ),
    check("menu_items_target_type_valid", sql`${item.targetType} IN ('content', 'route', 'external', 'label')`),
  ],
);
