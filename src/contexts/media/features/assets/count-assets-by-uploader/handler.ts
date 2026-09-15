// Leitura pública (sem authorizeActor): só devolve uma contagem, nunca identidade/arquivo —
// usada por platform/identity-lifecycle/purge-user-safely.ts pra decidir se um hard delete de
// usuário é seguro.
import { countAssetsByUploader } from "./service";
import type { CountAssetsByUploaderQuery, CountAssetsByUploaderResult } from "./types";

export async function countAssetsByUploaderHandler(query: CountAssetsByUploaderQuery): Promise<CountAssetsByUploaderResult> {
  return countAssetsByUploader(query);
}
