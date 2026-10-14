import { cache } from "react";
import { getPluginRegistrationReport } from "./register-plugins";

// Conjunto das `key` de plugin com status "active" no relatório de registro (docs/venore-docks.md
// — regra 12). Mesmo dado que isPluginActive() checa por key, só que resolvido de uma vez pra
// quem precisa filtrar uma coleção inteira num único request: o palette de blocos do builder do
// CMS (listBlockDefinitions), o dispatch de render de bloco (components/page-builder/
// block-renderer.tsx) e o registro de breadcrumbs. registerPlugins() não cacheia (deploy é
// serverless — ver comentário em register-plugins.ts), então cada REQUEST lê fresco do banco —
// mas uma vez só: cache() memoiza dentro do request (a v8 soma outlets de tema, W7, aos
// consumidores acima; fora de um request React, cache() não memoiza e cada chamada lê de novo).
export const getActivePluginKeys = cache(async (): Promise<Set<string>> => {
  const report = await getPluginRegistrationReport();
  return new Set(report.entries.filter((entry) => entry.status === "active").map((entry) => entry.key));
});
