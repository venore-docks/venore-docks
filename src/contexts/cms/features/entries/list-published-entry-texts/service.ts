import { extractEntryPlainText } from "../../../contracts/entry-text";
import { findEntryIdsKeepingSpeech, findReadableEntriesUpdatedAfter } from "./store";
import type { ListPublishedEntryTextsQuery, PublishedEntryText } from "./types";

// Sem authorizeActor: devolve só conteúdo que qualquer visitante já lê no site. Exportado pelo
// barrel para platform/speech/sync-cms-entry-speech.ts (regra 14), nunca para o SDK.
export async function listPublishedEntryTexts(query: ListPublishedEntryTextsQuery): Promise<PublishedEntryText[]> {
  const rows = await findReadableEntriesUpdatedAfter(query.updatedAfter, query.limit);
  return rows.map((row) => ({ id: row.id, updatedAt: row.updatedAt, text: extractEntryPlainText(row.title, row.data) }));
}

// Dos ids com áudio, os que ainda podem mantê-lo (não apagados, não arquivados, públicos).
export async function filterEntryIdsKeepingSpeech(ids: string[]): Promise<string[]> {
  return findEntryIdsKeepingSpeech(ids);
}
