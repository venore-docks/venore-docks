import { beginOperation, endOperation } from "@/observability";
import type { OperationResult } from "@/shared/types";
import { requeueFailedClips } from "../../shared/store";
import { scheduleSpeechProcessing } from "../process-pending-speech/service";

// Textos com falha (tentativas esgotadas) voltam para a fila do zero — de um scope ou todos. Quem
// chama já checou settings.manage (action do painel /admin/speech).
export async function retryFailedSpeech(input: { scope?: string | null }): Promise<OperationResult<{ requeued: number }>> {
  const handle = beginOperation({ useCase: "speech.retry-failed", actor: { id: "system", type: "system" }, kind: "write" });
  const requeued = await requeueFailedClips(input.scope?.trim() || null);
  if (requeued > 0) scheduleSpeechProcessing();
  endOperation(handle, { success: true });
  return { success: true, data: { requeued } };
}
