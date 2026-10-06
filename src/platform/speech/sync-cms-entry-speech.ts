import { filterEntryIdsKeepingSpeech, listPublishedEntryTexts } from "@/contexts/cms";
import { getSetting } from "@/contexts/settings";
import {
  getSpeechSyncCursor,
  listSpeechScopes,
  readSpeechSettings,
  setSpeechSyncCursor,
  syncSpeechAudio,
} from "@/contexts/speech";
import { DEFAULT_SITE_LOCALE, canonicalLocale } from "@/shared/locale";
import type { OperationResult } from "@/shared/types";
import { CMS_ENTRY_SPEECH_PREFIX as SCOPE_PREFIX, cmsEntrySpeechScope } from "./cms-entry-scope";

const CURSOR_KEY = "cms.entries";
const BATCH_SIZE = 50;

async function siteLocale(): Promise<string> {
  const result = await getSetting({ key: "platform.locale" });
  return (result.success && canonicalLocale(result.data?.value)) || DEFAULT_SITE_LOCALE;
}

// Composição cms + speech (regra 14). O CMS publica por vários caminhos (publicar, agendamento,
// editar entry já publicada, aplicar revisão, importar) e nenhum deles avisa ninguém; em vez de
// espalhar chamadas pelo context cms, este job reconcilia: entries com "Gerar áudio" marcado,
// publicadas e públicas, que mudaram desde o cursor ganham o áudio do texto atual, e o áudio de entry arquivada, apagada ou
// que virou "só logado" ou teve a opção desmarcada é removido (o MP3 é público). Entry que voltou para rascunho mantém o
// áudio: republicar sem mudar o texto não paga a síntese de novo.
export async function syncCmsEntrySpeech(): Promise<OperationResult<{ synced: number; removed: number }>> {
  const settings = await readSpeechSettings();
  if (!settings.enabled) return { success: true, data: { synced: 0, removed: 0 } };

  const locale = await siteLocale();
  const cursor = await getSpeechSyncCursor(CURSOR_KEY);
  const changed = await listPublishedEntryTexts({ updatedAfter: cursor, limit: BATCH_SIZE });
  for (const entry of changed) {
    const result = await syncSpeechAudio({
      scope: cmsEntrySpeechScope(entry.id),
      items: [{ itemKey: "body", locale, text: entry.text }],
      source: { label: entry.title, href: `/admin/cms/entries/${entry.id}` },
    });
    if (!result.success) return result;
    await setSpeechSyncCursor(CURSOR_KEY, entry.updatedAt);
  }

  const scopes = await listSpeechScopes(SCOPE_PREFIX);
  const keeping = new Set(await filterEntryIdsKeepingSpeech(scopes.map((scope) => scope.slice(SCOPE_PREFIX.length))));
  let removed = 0;
  for (const scope of scopes) {
    if (keeping.has(scope.slice(SCOPE_PREFIX.length))) continue;
    const result = await syncSpeechAudio({ scope, items: [] });
    if (!result.success) return result;
    removed += result.data.removed;
  }

  return { success: true, data: { synced: changed.length, removed } };
}
