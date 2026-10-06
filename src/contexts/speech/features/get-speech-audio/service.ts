import { getMediaAssetUrls } from "@/contexts/media";
import type { OperationResult } from "@/shared/types";
import type { SpeechAudio } from "../../contracts/types";
import { readSpeechSettings } from "../../shared/speech-settings";
import { listReadyClipsByScopes } from "../../shared/store";

export type GetSpeechAudioQuery = { scopes: string[] };
export type GetSpeechAudioResult = OperationResult<Record<string, SpeechAudio[]>>;

// Leitura pública (página aberta por visitante): só áudio pronto, só com a leitura ligada. Os MP3
// são assets públicos, então getMediaAssetUrls devolve a URL mesmo sem sessão.
export async function getSpeechAudio(query: GetSpeechAudioQuery): Promise<GetSpeechAudioResult> {
  const scopes = [...new Set(query.scopes.filter(Boolean))];
  const empty = Object.fromEntries(scopes.map((scope) => [scope, [] as SpeechAudio[]]));
  if (scopes.length === 0 || !(await readSpeechSettings()).enabled) return { success: true, data: empty };

  const clips = (await listReadyClipsByScopes(scopes)).filter((clip) => clip.mediaAssetId);
  if (clips.length === 0) return { success: true, data: empty };

  const urls = await getMediaAssetUrls({ ids: clips.map((clip) => clip.mediaAssetId!) });
  if (!urls.success) return urls;

  const byScope: Record<string, SpeechAudio[]> = empty;
  for (const clip of clips) {
    const url = urls.data[clip.mediaAssetId!];
    if (url) byScope[clip.scope].push({ itemKey: clip.itemKey, locale: clip.locale, url });
  }
  return { success: true, data: byScope };
}
