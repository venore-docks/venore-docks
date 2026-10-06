import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { audioClips, scopeSources, syncCursors, usageMonths, workerHeartbeats } from "../database/schema";
import type { SpeechClipStatus, SpeechProgress } from "../contracts/types";

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
    .values({ ...input, status: "pending", attempts: 0, progress: 0, mediaAssetId: null, lastError: null, synthesizedAt: null })
    .onConflictDoUpdate({
      target: [audioClips.scope, audioClips.itemKey, audioClips.locale],
      set: {
        text: input.text,
        voice: input.voice,
        textHash: input.textHash,
        characters: input.characters,
        status: "pending",
        attempts: 0,
        progress: 0,
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
    update ${audioClips} set status = 'processing', progress = 0, updated_at = now()
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
    .set({ status: "pending", progress: 0 })
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
    .set({ status: "ready", progress: 100, mediaAssetId, lastError: null, synthesizedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(audioClips.id, id), eq(audioClips.textHash, textHash), eq(audioClips.status, "processing")))
    .returning({ id: audioClips.id });
  return updated.length > 0;
}

export async function recordClipFailure(id: string, textHash: string, message: string, maxAttempts: number): Promise<void> {
  await db
    .update(audioClips)
    .set({
      attempts: sql`${audioClips.attempts} + 1`,
      progress: 0,
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

export async function upsertScopeSource(scope: string, label: string, href: string | null): Promise<void> {
  await db
    .insert(scopeSources)
    .values({ scope, label, href })
    .onConflictDoUpdate({ target: scopeSources.scope, set: { label, href, updatedAt: new Date() } });
}

export async function deleteScopeSource(scope: string): Promise<void> {
  await db.delete(scopeSources).where(eq(scopeSources.scope, scope));
}

export type ScopeProgressRow = SpeechProgress & {
  scope: string;
  label: string | null;
  href: string | null;
  characters: number;
};

export const emptyProgress = (): SpeechProgress => ({
  total: 0,
  ready: 0,
  pending: 0,
  processing: 0,
  failed: 0,
  currentPercent: null,
  lastError: null,
  updatedAt: null,
});

// Contagem por status de cada scope, mais a origem descrita pelo dono. `scopes` nulo = todos
// (painel), limitado aos `limit` scopes mexidos por último — os que ainda têm fila primeiro.
export async function listScopeProgress(scopes: string[] | null, limit = 200): Promise<ScopeProgressRow[]> {
  if (scopes && scopes.length === 0) return [];
  const open = sql<number>`count(*) filter (where ${audioClips.status} in ('pending', 'processing', 'failed'))::int`;
  const rows = await db
    .select({
      scope: audioClips.scope,
      label: scopeSources.label,
      href: scopeSources.href,
      total: sql<number>`count(*)::int`,
      ready: sql<number>`count(*) filter (where ${audioClips.status} = 'ready')::int`,
      pending: sql<number>`count(*) filter (where ${audioClips.status} = 'pending')::int`,
      processing: sql<number>`count(*) filter (where ${audioClips.status} = 'processing')::int`,
      failed: sql<number>`count(*) filter (where ${audioClips.status} = 'failed')::int`,
      currentPercent: sql<number | null>`max(${audioClips.progress}) filter (where ${audioClips.status} = 'processing')`,
      characters: sql<number>`coalesce(sum(${audioClips.characters}), 0)::int`,
      lastError: sql<string | null>`(array_agg(${audioClips.lastError} order by ${audioClips.updatedAt} desc) filter (where ${audioClips.lastError} is not null))[1]`,
      updatedAt: sql<string>`max(${audioClips.updatedAt})`,
    })
    .from(audioClips)
    .leftJoin(scopeSources, eq(scopeSources.scope, audioClips.scope))
    .where(scopes ? inArray(audioClips.scope, scopes) : undefined)
    .groupBy(audioClips.scope, scopeSources.label, scopeSources.href)
    .orderBy(desc(sql`${open} > 0`), desc(sql`max(${audioClips.updatedAt})`))
    .limit(limit);
  return rows.map((row) => ({
    ...emptyProgress(),
    scope: row.scope,
    label: row.label,
    href: row.href,
    total: Number(row.total),
    ready: Number(row.ready),
    pending: Number(row.pending),
    processing: Number(row.processing),
    failed: Number(row.failed),
    currentPercent: row.currentPercent === null || row.currentPercent === undefined ? null : Number(row.currentPercent),
    characters: Number(row.characters),
    lastError: row.lastError ?? null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
}

// Falhas voltam para a fila do zero (tentativas zeradas). `scope` nulo = todas.
export async function requeueFailedClips(scope: string | null): Promise<number> {
  const updated = await db
    .update(audioClips)
    .set({ status: "pending", attempts: 0, progress: 0, lastError: null, updatedAt: new Date() })
    .where(scope ? and(eq(audioClips.status, "failed"), eq(audioClips.scope, scope)) : eq(audioClips.status, "failed"))
    .returning({ id: audioClips.id });
  return updated.length;
}

// Último áudio terminado — o painel mostra "último áudio gerado há X" para saber se o worker anda.
export async function findLastSynthesizedAt(): Promise<Date | null> {
  const [row] = await db.select({ at: sql<string | null>`max(${audioClips.synthesizedAt})` }).from(audioClips);
  return row?.at ? new Date(row.at) : null;
}

// Andamento do texto em síntese. Também renova a reserva (updatedAt): texto longo que avisa
// progresso não volta para a fila no meio da geração.
export async function setClipProgress(id: string, textHash: string, percent: number): Promise<boolean> {
  const updated = await db
    .update(audioClips)
    .set({ progress: Math.max(0, Math.min(99, Math.round(percent))), updatedAt: new Date() })
    .where(and(eq(audioClips.id, id), eq(audioClips.textHash, textHash), eq(audioClips.status, "processing")))
    .returning({ id: audioClips.id });
  return updated.length > 0;
}

export type WorkerHeartbeat = { stage: string; detail: string | null; startedAt: Date; updatedAt: Date };
const HEARTBEAT_KEY = "worker";

// Mudar de fase reinicia startedAt; repetir a mesma fase só renova updatedAt.
export async function recordWorkerHeartbeat(stage: string, detail: string | null): Promise<void> {
  const now = new Date();
  await db
    .insert(workerHeartbeats)
    .values({ key: HEARTBEAT_KEY, stage, detail, startedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: workerHeartbeats.key,
      set: {
        stage,
        detail,
        updatedAt: now,
        startedAt: sql`case when ${workerHeartbeats.stage} = ${stage} then ${workerHeartbeats.startedAt} else ${now.toISOString()}::timestamptz end`,
      },
    });
}

export async function findWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  const [row] = await db
    .select({ stage: workerHeartbeats.stage, detail: workerHeartbeats.detail, startedAt: workerHeartbeats.startedAt, updatedAt: workerHeartbeats.updatedAt })
    .from(workerHeartbeats)
    .where(eq(workerHeartbeats.key, HEARTBEAT_KEY));
  return row ?? null;
}
