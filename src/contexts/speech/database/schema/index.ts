import { index, integer, pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const speechSchema = pgSchema("speech");

// Um áudio por (scope, itemKey, locale). `scope` agrupa o que o dono sincroniza de uma vez
// ("cms.entry:<id>", "novels.work:<id>") e `itemKey` identifica o texto dentro dele ("body",
// "scene:<id>"). `text` fica guardado porque a síntese roda depois, num job; `textHash` cobre
// texto + voz + modelo, então trocar qualquer um deles marca o áudio para gerar de novo.
// `mediaAssetId` é texto solto, sem FK pra media.assets (FK cross-schema é evitada).
export const audioClips = speechSchema.table(
  "audio_clips",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scope: text("scope").notNull(),
    itemKey: text("item_key").notNull(),
    locale: text("locale").notNull(),
    text: text("text").notNull(),
    // Voz gravada junto: a síntese roda depois, e trocar a voz no meio não pode gerar um áudio
    // diferente do que o hash descreve.
    voice: text("voice").notNull(),
    textHash: text("text_hash").notNull(),
    characters: integer("characters").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    mediaAssetId: text("media_asset_id"),
    synthesizedAt: timestamp("synthesized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("audio_clips_item_idx").on(table.scope, table.itemKey, table.locale),
    index("audio_clips_status_idx").on(table.status),
  ],
);

// Caracteres enviados ao provedor por mês (UTC, "2026-10"). Contador próprio, separado dos
// áudios: um áudio regerado no mesmo mês sobrescreve a linha dele, mas a cota já foi gasta.
export const usageMonths = speechSchema.table("usage_months", {
  month: text("month").primaryKey(),
  characters: integer("characters").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Até onde uma reconciliação já foi (ex: "cms.entries" guarda o updatedAt da última entry
// sincronizada) — quem reconcilia retoma dali no próximo tick.
export const syncCursors = speechSchema.table("sync_cursors", {
  key: text("key").primaryKey(),
  cursor: timestamp("cursor", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
