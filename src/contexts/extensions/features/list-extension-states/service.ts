import { findExtensionStatesByKind } from "./store";
import type { ListExtensionStatesQuery, ListExtensionStatesResult } from "./types";

// Sem cache de propósito (ver get-extension-state/service.ts): register-plugins.ts decide se um
// plugin está ativo a partir deste resultado, e um cache TTL por-processo aqui é o que causava
// rota de plugin dando 404 / plugin "sumindo" da listagem por até o TTL depois de instalar,
// habilitar ou desabilitar — nas instâncias serverless que não foram a que escreveu o estado.
export async function listExtensionStates(query: ListExtensionStatesQuery): Promise<ListExtensionStatesResult> {
  const rows = await findExtensionStatesByKind(query.kind);
  const map = Object.fromEntries(
    rows.map((row) => [row.key, { installed: row.installedAt !== null, enabled: row.enabled }]),
  );

  return { success: true, data: map };
}
