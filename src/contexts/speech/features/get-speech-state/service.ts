import { speechPort } from "@/infrastructure/speech";
import type { GetSpeechStateInput, GetSpeechStateResult, SpeechState } from "../../contracts/types";
import { MAX_ITEM_CHARACTERS } from "../../shared/constants";
import { countCharacters, normalizeSpeechText, speechLanguageCode } from "../../shared/language";
import { readSpeechSettings } from "../../shared/speech-settings";
import { listClipsByScope } from "../../shared/store";

const itemId = (itemKey: string, locale: string) => `${itemKey}\u0000${locale}`;

// Áudio de um scope comparado ao texto que o dono tem agora: o que está pronto e em dia, pronto
// mas com texto mudado (desatualizado — continua tocando), faltando, na fila, gerando, com falha.
// Só leitura e só contagens; o dono mostra na tela de edição, que já passou pelo gate. Desatualizado
// compara só o texto: trocar a voz não marca tudo como desatualizado (para isso, "gerar de novo").
export async function getSpeechState(input: GetSpeechStateInput): Promise<GetSpeechStateResult> {
  const scope = input.scope.trim();
  const settings = await readSpeechSettings();
  const state: SpeechState = {
    active: settings.enabled && speechPort.isEnabled(),
    total: 0,
    ready: 0,
    outdated: 0,
    missing: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    extra: 0,
    currentPercent: null,
    lastError: null,
  };
  const clips = new Map((scope ? await listClipsByScope(scope) : []).map((clip) => [itemId(clip.itemKey, clip.locale), clip]));
  const seen = new Set<string>();

  for (const item of input.items) {
    const text = normalizeSpeechText(item.text);
    const characters = countCharacters(text);
    const id = itemId(item.itemKey, item.locale);
    if (!item.itemKey || !speechLanguageCode(item.locale) || characters === 0 || characters > MAX_ITEM_CHARACTERS || seen.has(id)) continue;
    seen.add(id);
    state.total += 1;

    const clip = clips.get(id);
    if (!clip) state.missing += 1;
    else if (clip.status === "ready") {
      if (clip.text === text) state.ready += 1;
      else state.outdated += 1;
    } else if (clip.status === "failed") {
      state.failed += 1;
      state.lastError ??= clip.lastError;
    } else if (clip.status === "processing") {
      state.processing += 1;
      state.currentPercent = Math.max(state.currentPercent ?? 0, clip.progress);
    } else state.pending += 1;
  }
  for (const id of clips.keys()) if (!seen.has(id)) state.extra += 1;
  return { success: true, data: state };
}
