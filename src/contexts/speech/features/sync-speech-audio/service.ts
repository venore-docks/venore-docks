import { deleteGeneratedAssets } from "@/contexts/media";
import { speechPort } from "@/infrastructure/speech";
import { beginOperation, endOperation } from "@/observability";
import type { SyncSpeechAudioInput, SyncSpeechAudioResult } from "../../contracts/types";
import { MAX_ITEM_CHARACTERS, MAX_ITEMS_PER_SCOPE, SPEECH_MEDIA_CATEGORY_KEY } from "../../shared/constants";
import { countCharacters, normalizeSpeechText, speechLanguageCode, speechTextHash } from "../../shared/language";
import { readSpeechSettings } from "../../shared/speech-settings";
import { deleteClips, listClipsByScope, upsertPendingClip } from "../../shared/store";
import { scheduleSpeechProcessing } from "../process-pending-speech/service";

const itemId = (itemKey: string, locale: string) => `${itemKey}\u0000${locale}`;

// Leva o scope ao estado pedido: texto novo ou mudado entra na fila (o MP3 antigo, se havia, é
// apagado na hora — não toca áudio de um texto que já não é o publicado); texto igual não gasta
// nada; item que saiu da lista perde o áudio. Com a leitura desligada nada entra na fila, mas
// remoção e texto mudado continuam limpando o que ficou velho.
//
// Chamado por código de sistema (publicação do dono do conteúdo), sem sessão: não há o que
// autorizar — o scope é do chamador. Plugin chama via @venore/plugin-sdk/speech.
export async function syncSpeechAudio(input: SyncSpeechAudioInput): Promise<SyncSpeechAudioResult> {
  const handle = beginOperation({ useCase: "speech.sync-audio", actor: { id: "system", type: "system" }, kind: "write" });
  const fail = (code: string, message: string): SyncSpeechAudioResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const scope = input.scope.trim();
  if (!scope) return fail("speech.invalid_scope", "scope não pode ser vazio.");
  if (input.items.length > MAX_ITEMS_PER_SCOPE) return fail("speech.too_many_items", `No máximo ${MAX_ITEMS_PER_SCOPE} textos por scope.`);

  const settings = await readSpeechSettings();
  const active = settings.enabled && speechPort.isEnabled();
  const existing = new Map((await listClipsByScope(scope)).map((clip) => [itemId(clip.itemKey, clip.locale), clip]));

  const keep = new Set<string>();
  const removeClipIds: string[] = [];
  const removeAssetIds: string[] = [];
  let queued = 0;
  let unchanged = 0;

  for (const item of input.items) {
    const languageCode = speechLanguageCode(item.locale);
    const text = normalizeSpeechText(item.text);
    const characters = countCharacters(text);
    if (!item.itemKey || !languageCode || characters === 0 || characters > MAX_ITEM_CHARACTERS) continue;

    const id = itemId(item.itemKey, item.locale);
    if (keep.has(id)) continue;
    const current = existing.get(id);
    const textHash = speechTextHash({ model: speechPort.model, voice: settings.voice, languageCode, text });

    if (current && current.textHash === textHash && current.status !== "failed") {
      keep.add(id);
      unchanged += 1;
      continue;
    }
    if (!active) continue;

    keep.add(id);
    if (current?.mediaAssetId) removeAssetIds.push(current.mediaAssetId);
    await upsertPendingClip({ scope, itemKey: item.itemKey, locale: item.locale, text, voice: settings.voice, textHash, characters });
    queued += 1;
  }

  for (const [id, clip] of existing) {
    if (keep.has(id)) continue;
    removeClipIds.push(clip.id);
    if (clip.mediaAssetId) removeAssetIds.push(clip.mediaAssetId);
  }

  await deleteClips(removeClipIds);
  if (removeAssetIds.length > 0) {
    const deleted = await deleteGeneratedAssets({ ids: removeAssetIds, categoryKey: SPEECH_MEDIA_CATEGORY_KEY });
    if (!deleted.success) return fail(deleted.error.code, deleted.error.message);
  }
  if (queued > 0) scheduleSpeechProcessing();

  endOperation(handle, { success: true });
  return { success: true, data: { queued, unchanged, removed: removeClipIds.length } };
}
