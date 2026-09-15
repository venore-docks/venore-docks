import { pgSchema, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { categories } from "@/contexts/cms/database/schema";

export const contentFeedSchema = pgSchema("content_feed");

// Lado PUBLICADOR — "quem pode ler daqui" (pedido explícito: "podemos criar uma chave de conexão
// entre eles, escolher quais categorias vão"). `key` é o segredo que a instância assinante
// apresenta em cada request (header X-Feed-Key) — texto plano, comparado em tempo constante no
// service (mesmo racional de broadcast.diagnosticsAgentKey no plugin broadcast, ver
// features/publisher/list-articles-for-connection/service.ts): o blast radius de um vazamento é
// limitado (só entries já status=published + visibility=public, nas categorias permitidas), então
// não precisa do custo de um hash tipo PIN.
export const contentFeedConnections = contentFeedSchema.table("connections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  key: text("key")
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

// FK real pra cms.categories — precedente já existe em cms.entries.authorId -> auth.users.id
// (cross-context com FK de verdade dentro do core, diferente da regra de plugin/context que
// proíbe até leitura de schema interno de outro context). Cascade: apagar uma categoria do NOSSO
// CMS também tira ela de qualquer conexão que a permitia — nunca deixa uma linha órfã apontando
// pra categoria inexistente.
export const contentFeedConnectionCategories = contentFeedSchema.table(
  "connection_categories",
  {
    connectionId: text("connection_id")
      .notNull()
      .references(() => contentFeedConnections.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.connectionId, table.categoryId] })],
);

// Lado ASSINANTE — "de onde eu leio". connectionKey é a chave que O OUTRO lado (o publicador) nos
// deu — não temos como validar contra nada localmente, só apresentamos de volta no header a cada
// sync. lastSyncError guarda a última falha em texto (rede fora do ar, chave inválida, etc.) pra
// mostrar na UI sem precisar de uma tabela de log à parte — sync é sempre "estado agora", nunca
// histórico (mesmo racional de broadcast_output_diagnostics no plugin broadcast).
export const contentFeedSources = contentFeedSchema.table("sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  remoteUrl: text("remote_url").notNull(),
  connectionKey: text("connection_key").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// categoryKey (não categoryId) — é a chave de categoria do CMS do OUTRO lado, nunca temos o id
// real dele (bancos diferentes). Sem FK possível; uma chave que não bate em nada no publicador
// simplesmente nunca traz artigo, não é erro (ver contracts, sem descoberta automática de
// categoria nesta fase).
export const contentFeedSourceCategories = contentFeedSchema.table(
  "source_categories",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => contentFeedSources.id, { onDelete: "cascade" }),
    categoryKey: text("category_key").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sourceId, table.categoryKey] })],
);

// Cache local do que já foi sincronizado — "estado agora" por artigo (upsert por
// sourceId+remoteRef), nunca uma tabela de histórico/versões. entrySlug/categorySlug (não uma URL
// pronta) porque o publicador não sabe a própria origem pública com certeza (poderia vir por IP
// interno, proxy, etc.) — quem monta o link "leia mais" é o assinante, a partir de
// source.remoteUrl + esses dois slugs, na hora de exibir.
export const contentFeedArticles = contentFeedSchema.table(
  "articles",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sourceId: text("source_id")
      .notNull()
      .references(() => contentFeedSources.id, { onDelete: "cascade" }),
    remoteRef: text("remote_ref").notNull(),
    title: text("title").notNull(),
    excerptText: text("excerpt_text"),
    coverImageUrl: text("cover_image_url"),
    categoryKey: text("category_key").notNull(),
    entrySlug: text("entry_slug").notNull(),
    categorySlug: text("category_slug"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("content_feed_articles_source_remote_ref_idx").on(table.sourceId, table.remoteRef)],
);
