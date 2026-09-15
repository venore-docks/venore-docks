import { beginOperation, endOperation } from "@/observability";
import { findSourceById, updateSourceSyncState, upsertArticles } from "./store";
import type { SyncSourceCommand, SyncSourceResult } from "./types";
import type { ContentFeedApiResponse } from "../../../contracts/types";

const FETCH_TIMEOUT_MS = 10_000;

// Nunca lança — falha de rede/publicador vira lastSyncError gravado no source, não exceção. O
// OperationResult segue success:true mesmo quando a sincronização falhou: a OPERAÇÃO "tentar
// sincronizar" foi executada com sucesso, o resultado (data.error) é que carrega o que aconteceu —
// o handler nunca precisa tratar isso como falha de autorização/validação de borda.
export async function syncSource(command: SyncSourceCommand): Promise<SyncSourceResult> {
  const handle = beginOperation({
    useCase: "content-feed.sync-source",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });

  const source = await findSourceById(command.id);
  if (!source) {
    const error = { code: "content-feed.sources.not_found", message: `Fonte "${command.id}" não encontrada.` };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }

  try {
    const url = new URL("/api/content-feed/articles", source.remoteUrl);
    if (source.lastSyncedAt) {
      url.searchParams.set("since", source.lastSyncedAt.toISOString());
    }

    const response = await fetch(url, {
      headers: { "X-Feed-Key": source.connectionKey },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Publicador respondeu ${response.status}.`);
    }

    const payload = (await response.json()) as ContentFeedApiResponse;
    const relevantArticles =
      source.categoryKeys.length > 0
        ? payload.articles.filter((article) => source.categoryKeys.includes(article.categoryKey))
        : payload.articles;

    await upsertArticles(source.id, relevantArticles);
    await updateSourceSyncState(source.id, { lastSyncedAt: new Date(), lastSyncError: null });

    endOperation(handle, { success: true });
    return { success: true, data: { syncedCount: relevantArticles.length, error: null } };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha desconhecida ao sincronizar.";
    await updateSourceSyncState(source.id, { lastSyncError: message });
    endOperation(handle, { success: false, error: { code: "content-feed.sources.sync_failed", message } });
    return { success: true, data: { syncedCount: 0, error: message } };
  }
}
