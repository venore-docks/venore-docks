import { deleteGeneratedAssets } from "@/contexts/media";
import { speechPort } from "@/infrastructure/speech";
import { beginOperation, endOperation } from "@/observability";
import type { OperationResult } from "@/shared/types";
import { SPEECH_MEDIA_CATEGORY_KEY } from "../../shared/constants";
import { speechLanguageCode, speechTextHash } from "../../shared/language";
import { readSpeechSettings } from "../../shared/speech-settings";
import { listClipsByScope, upsertPendingClip } from "../../shared/store";
import { scheduleSpeechProcessing } from "../process-pending-speech/service";

// "Gerar de novo": todas as faixas do scope voltam para a fila com a voz atual (trocar a voz ou
// melhorar o worker não refaz o que já estava pronto). O MP3 antigo sai na hora — até o novo ficar
// pronto, o conteúdo fica sem áudio. Quem chama já checou settings.manage (painel /admin/speech).
export async function regenerateSpeech(input: { scope: string }): Promise<OperationResult<{ requeued: number }>> {
  const scope = input.scope.trim();
  if (!scope) return { success: false, error: { code: "speech.invalid_scope", message: "scope não pode ser vazio." } };
  const settings = await readSpeechSettings();
  if (!settings.enabled || !speechPort.isEnabled()) {
    return { success: false, error: { code: "speech.disabled", message: "A leitura em voz alta está desligada." } };
  }

  const handle = beginOperation({ useCase: "speech.regenerate", actor: { id: "system", type: "system" }, kind: "write" });
  const oldAssetIds: string[] = [];
  let requeued = 0;
  for (const clip of await listClipsByScope(scope)) {
    const languageCode = speechLanguageCode(clip.locale);
    if (!languageCode) continue;
    const textHash = speechTextHash({ model: speechPort.model, voice: settings.voice, languageCode, text: clip.text });
    if (clip.mediaAssetId) oldAssetIds.push(clip.mediaAssetId);
    await upsertPendingClip({
      scope,
      itemKey: clip.itemKey,
      locale: clip.locale,
      text: clip.text,
      voice: settings.voice,
      textHash,
      characters: clip.characters,
    });
    requeued += 1;
  }

  if (oldAssetIds.length > 0) {
    const deleted = await deleteGeneratedAssets({ ids: oldAssetIds, categoryKey: SPEECH_MEDIA_CATEGORY_KEY });
    if (!deleted.success) {
      endOperation(handle, { success: false, error: deleted.error });
      return deleted;
    }
  }
  if (requeued > 0) scheduleSpeechProcessing();
  endOperation(handle, { success: true });
  return { success: true, data: { requeued } };
}
