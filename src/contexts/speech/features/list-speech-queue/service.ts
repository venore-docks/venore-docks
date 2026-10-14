import type { OperationResult } from "@/shared/types";
import type { SpeechProgress } from "../../contracts/types";
import { listScopeProgress } from "../../shared/store";

export type SpeechQueueItem = SpeechProgress & {
  scope: string;
  // Título e link do editor que o dono informou ao sincronizar; sem isso, o scope cru.
  label: string;
  href: string | null;
  characters: number;
};

const QUEUE_LIMIT = 200;

// Painel /admin/speech: cada conteúdo com áudio, os que ainda têm fila (ou falha) primeiro. Quem
// chama já checou settings.manage (getSettingsPageData).
export async function listSpeechQueue(): Promise<OperationResult<{ items: SpeechQueueItem[]; truncated: boolean }>> {
  const rows = await listScopeProgress(null, QUEUE_LIMIT + 1);
  const items = rows.slice(0, QUEUE_LIMIT).map((row) => ({ ...row, label: row.label ?? row.scope }));
  return { success: true, data: { items, truncated: rows.length > QUEUE_LIMIT } };
}
