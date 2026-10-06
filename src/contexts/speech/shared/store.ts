import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { audioClips, syncCursors, usageMonths } from "../database/schema";
import type { SpeechClipStatus } from "../contracts/types";

export type StoredClip = {
  id: string;
  scope: string;
  itemKey: string;
  locale: string;
  text: string;
  voice: string;
  textHash: string;
  characters: number;
  status: SpeechClipStatus;
  attempts: number;
  mediaAssetId: string | null;
};

const clipColumns = {
  id: audioClips.id,
  scope: audioClips.scope,
  itemKey: audioClips.itemKey,
  locale: audioClips.locale,
  text: audioClips.text,
  voice: audioClips.voice,
  textHash: audioClips.textHash,
  characters: audioClips.characters,
  status: audioClips.status,
  attempts: audioClips.attempts,
  mediaAssetId: audioClips.mediaAssetId,
};

type ClipRow = Omit<StoredClip, "status"> & { status: string };
const toClip = (row: ClipRow): StoredClip => ({ ...row, status: row.status as SpeechClipStatus });

export async function listClipsByScope(scope: string): Promise<StoredClip[]> {
  return (await db.select(clipColumns).from(audioClips).where(eq(audioClips.scope, scope))).map(toClip);
}

export async function listReadyClipsByScopes(scopes: string[]): Promise<StoredClip[]> {
  if (scopes.length === 0) return [];
  const rows = await db
    .select(clipColumns)
    .from(audioClips)
    .where(and(inArray(audioClips.scope, scopes), eq(audioClips.status, "ready")));
  return rows.map(toClip);
}

export type ClipUpsert = {
  scope: string;
  itemKey: string;
  locale: string;
  text: string;
  voice: string;
  textHash: string;
  characters: number;
};

// Texto novo ou mudado volta para "pending" sem áudio; quem chama apaga o MP3 antigo.
export async function upsertPendingClip(input: ClipUpsert): Promise<void> {
  const now = new Date();
  await db
    .insert(audioClips)
    .values({ ...input, status: "pending", attempts: 0, mediaAssetId: null, lastError: null, synthesizedAt: null })
    .onConflictDoUpdate({
      target: [audioClips.scope, audioClips.itemKey, audioClips.locale],
      set: {
        text: input.text,
        voice: input.voice,
        textHash: input.textHash,
        characters: input.characters,
        status: "pending",
        attempts: 0,
        lastError: null,
        mediaAssetId: null,
        synthesizedAt: null,
        updatedAt: now,
      },
    });
}

export async function deleteClips(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(audioClips).where(inArray(audioClips.id, ids));
}

// Reserva até `limit` clips para sintetizar, marcando "processing" na mesma instrução (SKIP
// LOCKED: o job do cron e a geração disparada logo após publicar nunca pegam o mesmo clip — seria
// cota gasta duas vezes). Um "processing" parado há mais de PROCESSING_LEASE_MINUTES (função que
// morreu no meio) volta a ser elegível.
const PROCESSING_LEASE_MINUTES = 10;

export async function claimPendingClips(limit: number): Promise<StoredClip[]> {
  const result = await db.execute<{
    id: string;
    scope: string;
    item_key: string;
    locale: string;
    text: string;
    voice: string;
    text_hash: string;
    characters: number;
    status: string;
    attempts: number;
    media_asset_id: string | null;
  }>(sql`
    update ${audioClips} set status = 'processing', updated_at = now()
    where ${audioClips.id} in (
      select ${audioClips.id} from ${audioClips}
      where ${audioClips.status} = 'pending'
         or (${audioClips.status} = 'processing'
             and ${audioClips.updatedAt} < now() - make_interval(mins => ${PROCESSING_LEASE_MINUTES}))
      order by ${audioClips.updatedAt}
      limit ${limit}
      for update skip locked
    )
    returning id, scope, item_key, locale, text, voice, text_hash, characters, status, attempts, media_asset_id
  `);
  return result.rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    itemKey: row.item_key,
    locale: row.locale,
    text: row.text,
    voice: row.voice,
    textHash: row.text_hash,
    characters: Number(row.characters),
    status: row.status as SpeechClipStatus,
    attempts: Number(row.attempts),
    mediaAssetId: row.media_asset_id,
  }));
}

// Devolve para a fila sem contar tentativa (ex: teto do mês atingido).
export async function releaseClip(id: string, textHash: string): Promise<void> {
  await db
    .update(audioClips)
    .set({ status: "pending" })
    .where(and(eq(audioClips.id, id), eq(audioClips.textHash, textHash), eq(audioClips.status, "processing")));
}

export async function findProcessingClip(id: string, textHash: string): Promise<{ characters: number } | null> {
  const [row] = await db
    .select({ characters: audioClips.characters })
    .from(audioClips)
    .where(and(eq(audioClips.id, id), eq(audioClips.textHash, textHash), eq(audioClips.status, "processing")));
  return row ?? null;
}

export async function countClipsByStatus(): Promise<Record<SpeechClipStatus, number>> {
  const rows = await db
    .select({ status: audioClips.status, count: sql<number>`count(*)::int` })
    .from(audioClips)
    .groupBy(audioClips.status);
  const counts: Record<SpeechClipStatus, number> = { pending: 0, processing: 0, ready: 0, failed: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status as SpeechClipStatus] = Number(row.count);
  }
  return counts;
}

// Só marca pronto se o texto ainda for o mesmo que foi sintetizado: uma edição publicada no meio
// da síntese já trocou o hash e devolveu o clip para "pending". Devolve false nesse caso, para
// quem chama descartar o MP3 que acabou de gravar.
export async function markClipReady(id: string, textHash: string, mediaAssetId: string): Promise<boolean> {
  const updated = await db
    .update(audioClips)
    .set({ status: "ready", mediaAssetId, lastError: null, synthesizedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(audioClips.id, id), eq(audioClips.textHash, textHash), eq(audioClips.status, "processing")))
    .returning({ id: audioClips.id });
  return updated.length > 0;
}

export async function recordClipFailure(id: string, textHash: string, message: string, maxAttempts: number): Promise<void> {
  await db
    .update(audioClips)
    .set({
      attempts: sql`${audioClips.attempts} + 1`,
      status: sql`case when ${audioClips.attempts} + 1 >= ${maxAttempts} then 'failed' else 'pending' end`,
      lastError: message.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(and(eq(audioClips.id, id), eq(audioClips.textHash, textHash), eq(audioClips.status, "processing")));
}

export async function listScopesWithPrefix(prefix: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ scope: audioClips.scope })
    .from(audioClips)
    .where(sql`starts_with(${audioClips.scope}, ${prefix})`);
  return rows.map((row) => row.scope);
}

export async function findClipsByMediaAssetId(mediaAssetId: string): Promise<{ scope: string; itemKey: string; locale: string }[]> {
  return db
    .select({ scope: audioClips.scope, itemKey: audioClips.itemKey, locale: audioClips.locale })
    .from(audioClips)
    .where(eq(audioClips.mediaAssetId, mediaAssetId));
}

export async function getUsage(month: string): Promise<number> {
  const [row] = await db.select({ characters: usageMonths.characters }).from(usageMonths).where(eq(usageMonths.month, month));
  return row?.characters ?? 0;
}

// Reserva `characters` da cota do mês só se couber no teto — numa instrução só, então sínteses em
// paralelo nunca passam do teto juntas. false == não coube.
export async function reserveUsage(month: string, characters: number, limit: number): Promise<boolean> {
  await db.insert(usageMonths).values({ month, characters: 0 }).onConflictDoNothing({ target: usageMonths.month });
  const updated = await db
    .update(usageMonths)
    .set({ characters: sql`${usageMonths.characters} + ${characters}`, updatedAt: new Date() })
    .where(and(eq(usageMonths.month, month), sql`${usageMonths.characters} + ${characters} <= ${limit}`))
    .returning({ month: usageMonths.month });
  return updated.length > 0;
}

// Devolve a reserva quando o provedor recusou a chamada (não houve cobrança).
export async function refundUsage(month: string, characters: number): Promise<void> {
  await db
    .update(usageMonths)
    .set({ characters: sql`greatest(${usageMonths.characters} - ${characters}, 0)`, updatedAt: new Date() })
    .where(eq(usageMonths.month, month));
}

export async function getCursor(key: string): Promise<Date | null> {
  const [row] = await db.select({ cursor: syncCursors.cursor }).from(syncCursors).where(eq(syncCursors.key, key));
  return row?.cursor ?? null;
}

export async function setCursor(key: string, cursor: Date): Promise<void> {
  await db
    .insert(syncCursors)
    .values({ key, cursor })
    .onConflictDoUpdate({ target: syncCursors.key, set: { cursor, updatedAt: new Date() } });
}
