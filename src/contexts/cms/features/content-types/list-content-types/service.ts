import { getCache, setCache } from "../../../../../infrastructure/cache/memory-cache";
import { findAllContentTypesWithEntryCount } from "./store";
import type { ContentTypeRecord } from "../../../contracts/types";
import type { ListContentTypesResult } from "./types";

const CONTENT_TYPES_CACHE_KEY = "cms:content-types";
// 30s, não 300s: cache in-memory é por processo (infrastructure/cache/memory-cache.ts) — em
// produção com mais de uma instância, invalidateCache("cms:content-types") em create-content-type
// só limpa a instância que atendeu aquela escrita, nunca as outras. TTL alto deixava uma tag recém
// criada sumida das outras instâncias por até 5min (sintoma reportado: "demora muito pra
// aparecer" no seletor de tags de create-entry-form/edit-entry-form). 30s é o mesmo piso já usado
// por get-menu-by-location/get-contextual-menu — bound curto o bastante pra não incomodar, ainda
// assim poupa leitura repetida na mesma instância.
const CONTENT_TYPES_CACHE_TTL_SECONDS = 30;

export async function listContentTypes(): Promise<ListContentTypesResult> {
  const cached = getCache<Array<ContentTypeRecord & { entryCount: number }>>(CONTENT_TYPES_CACHE_KEY);
  if (cached) {
    return { success: true, data: cached };
  }

  const contentTypes = await findAllContentTypesWithEntryCount();
  setCache(CONTENT_TYPES_CACHE_KEY, contentTypes, CONTENT_TYPES_CACHE_TTL_SECONDS);

  return { success: true, data: contentTypes };
}
