import type { GetSpeechProgressQuery, GetSpeechProgressResult, SpeechProgress } from "../../contracts/types";
import { emptyProgress, listScopeProgress } from "../../shared/store";

// Andamento do áudio de cada scope pedido (scope sem nenhum texto vem zerado). Sem
// authorizeActor: só contagens, sem texto nem URL — o dono do scope mostra na tela de edição
// dele, que já passou pelo gate. Plugin chama via @venore/plugin-sdk/speech.
export async function getSpeechProgress(query: GetSpeechProgressQuery): Promise<GetSpeechProgressResult> {
  const scopes = [...new Set(query.scopes.map((scope) => scope.trim()).filter(Boolean))];
  const progress: Record<string, SpeechProgress> = Object.fromEntries(scopes.map((scope) => [scope, emptyProgress()]));
  for (const row of await listScopeProgress(scopes, scopes.length)) {
    progress[row.scope] = {
      total: row.total,
      ready: row.ready,
      pending: row.pending,
      processing: row.processing,
      failed: row.failed,
      currentPercent: row.currentPercent,
      lastError: row.lastError,
      updatedAt: row.updatedAt,
    };
  }
  return { success: true, data: progress };
}
