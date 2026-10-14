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
    // Andamento (0–100) do texto sendo gerado agora, informado pelo worker durante a síntese.
    progress: integer("progress").notNull().default(0),
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

// De onde vem cada scope, para o painel /admin/speech mostrar "onde é usado": o dono descreve o
// scope a cada sincronização (título e link do editor). Scope sem linha aqui aparece pelo nome cru.
export const scopeSources = speechSchema.table("scope_sources", {
  scope: text("scope").primaryKey(),
  label: text("label").notNull(),
  href: text("href"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sinal de vida do worker externo (SPEECH_DRIVER=worker), linha única "worker": em que fase está
// (preparing = instalando os modelos, generating, finished) e quando avisou por último. O painel
// usa para dizer se há geração acontecendo agora.
export const workerHeartbeats = speechSchema.table("worker_heartbeats", {
  key: text("key").primaryKey(),
  stage: text("stage").notNull(),
  detail: text("detail"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
