import { findExtensionState } from "./store";
import type { GetExtensionStateQuery, GetExtensionStateResult } from "./types";

// Sem cache de propósito: em produção o app roda como funções serverless (Vercel), cada uma com
// sua própria memória de processo. Um cache TTL aqui (como havia antes) fica desatualizado nas
// instâncias que não foram as que instalaram/desinstalaram/(des)habilitaram o plugin, por até o
// TTL inteiro — dá pra ver isso como "instalei, naveguei, voltou a aparecer desinstalado por ~1
// min". A leitura é um SELECT indexado numa tabela pequena; não vale o risco de inconsistência.
export async function getExtensionState(query: GetExtensionStateQuery): Promise<GetExtensionStateResult> {
  const row = await findExtensionState(query.kind, query.key);
  // Sem linha == não instalado E habilitado-por-default (ver contracts/types.ts).
  const state = { enabled: row?.enabled ?? true, installed: (row?.installedAt ?? null) !== null };

  return { success: true, data: state };
}
