import { check, index, integer, pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "@/contexts/auth/database/schema";

export const mediaSchema = pgSchema("media");

// Categoria é classificação organizacional de um asset (uma por asset, não tag — ver
// contracts/types.ts MediaCategory), não a classificação técnica de mimeType (MediaAssetCategory,
// que já existia).
export const categories = mediaSchema.table("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// `files` (fluxo server-buffered legado, storage em disco local) foi descontinuado —
// docs/implementation-roadmap.md, Fase 4/M1-M3: local storage só funcionava em dev, produção
// precisa de um storage real (Vercel Blob). `assets` (fluxo do blob-spec) é agora o único sistema
// de mídia; ganhou de volta `filename` (nome original, distinto de `pathname` — a key de storage
// sanitizada) e `categoryId` (que só existia em `files`) pra não perder essas duas capacidades na
// migração.
export const assets = mediaSchema.table(
  "assets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Nome original do arquivo (exibido na UI) — distinto de `pathname`, que é sempre
    // `${uuid}-${sanitizeFilename(filename)}` (a key real no storage, nunca aceita direto do
    // client). Sem isso, a biblioteca exibiria a key sanitizada como "nome do arquivo".
    filename: text("filename").notNull(),
    pathname: text("pathname").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    checksum: text("checksum").notNull(),
    // Nullable — o envio anônimo de currículo em vagas (uploadReservedCategoryAssetPublic) não
    // tem ator autenticado. FK continua valendo pra todo asset que tiver uploadedBy preenchido.
    uploadedBy: text("uploaded_by").references(() => users.id),
    // "public" (qualquer ator autenticado vê e usa), "restricted" (só o contexto de origem —
    // enforcement de consumo ainda não implementado, ver Known Gap no roadmap), "private" (só
    // dono + media.manage; avatar sempre nasce assim). Default "private" de propósito — nenhum
    // upload nasce público por omissão.
    visibility: text("visibility").notNull().default("private"),
    // Nullable — nem todo asset tem categoria. No máximo uma por asset (decisão de produto já
    // herdada de `files.categoryId`, não é tag N:N). onDelete "restrict": apagar uma categoria
    // com assets vinculados falha no banco, não só na aplicação.
    categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("media_assets_pathname_idx").on(table.pathname),
    index("media_assets_checksum_idx").on(table.checksum),
    index("media_assets_uploaded_by_idx").on(table.uploadedBy),
    index("media_assets_deleted_at_idx").on(table.deletedAt),
    check("media_assets_visibility_valid", sql`${table.visibility} IN ('public', 'restricted', 'private')`),
  ],
);
