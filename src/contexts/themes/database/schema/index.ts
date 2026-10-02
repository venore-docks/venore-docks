import { sql } from "drizzle-orm";
import { check, index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const themesSchema = pgSchema("themes");

// Rascunho e histórico do documento de configuração de tema (spec v8 §4.2). A versão PUBLICADA
// que o site renderiza vive no settings key `theme.config` — o render path nunca lê esta tabela
// (invariante §0.6), então um preview da Vercel sem esta migration renderiza igual; só o admin
// mostra o aviso (store devolve themes.config.storage_unavailable no 42P01).
//
// Um rascunho compartilhado por site e um publicado no máximo (índices únicos parciais); os
// arquivados são o histórico (podado em THEME_CONFIG_HISTORY_LIMIT pelo publish, W6).
// created_by/published_by são id de usuário sem FK (cross-schema, mesmo padrão de cms.media_id) e
// `text` porque auth.users.id é text.
export const themeConfigRevisions = themesSchema.table(
  "theme_config_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status").notNull(),
    config: jsonb("config").notNull(),
    basedOnRevisionId: uuid("based_on_revision_id"),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedBy: text("published_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (revision) => [
    check("theme_config_revisions_status_valid", sql`${revision.status} IN ('draft', 'published', 'archived')`),
    uniqueIndex("theme_config_revisions_single_draft_idx")
      .on(revision.status)
      .where(sql`${revision.status} = 'draft'`),
    uniqueIndex("theme_config_revisions_single_published_idx")
      .on(revision.status)
      .where(sql`${revision.status} = 'published'`),
    index("theme_config_revisions_archived_published_at_idx")
      .on(revision.publishedAt.desc())
      .where(sql`${revision.status} = 'archived'`),
  ],
);
